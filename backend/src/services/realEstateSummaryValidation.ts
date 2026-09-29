import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, lstat, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';
import { refreshAddressSummaries, type SummaryBatchResult } from './realEstateSummaryService.js';

const REAL_ESTATE_TYPES = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
const SALE_TYPES = new Set<RealEstateType>(['apt-sale', 'villa-sale', 'offitel-sale']);
const SOURCE_FINGERPRINT_BATCH_SIZE = 5_000;
const EMPTY_FINGERPRINT = '0'.repeat(64);

export interface SummaryValidationReport {
  runId: string;
  complete: boolean;
  sourceFingerprint: string;
  missingKeys: number;
  duplicateKeys: number;
  mismatchedGroups: number;
  originalChanged: boolean;
  batches: SummaryBatchResult[];
}

interface SummaryStateRow {
  status: 'preparing' | 'failed' | 'ready';
  runId: string;
  sourceFingerprint: string;
  report: unknown;
}

interface ValidationOptions {
  batches?: SummaryBatchResult[];
  beforeFingerprint?: string;
}

let beforeFinalFingerprintHookForTests: (() => Promise<void>) | undefined;

export function setSummaryValidationTestHookForTests(hook: (() => Promise<void>) | undefined): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Summary validation test hooks are only available in test mode');
  beforeFinalFingerprintHookForTests = hook;
}

interface PrepareOptions {
  reportOut?: string;
}

type VerifyOptions = PrepareOptions;

interface CountRow {
  count: bigint | number | null;
}

interface BatchValidationCountRow {
  missingKeys: bigint | number | null;
  mismatchedGroups: bigint | number | null;
  extraKeys: bigint | number | null;
}

function propertyTypeForSummary(type: string): string {
  return type.split('-')[0] ?? type;
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

function tableForType(type: string): string {
  const table = TABLE_NAME_MAP[type];
  if (!table || !isSafeIdentifier(table)) throw new Error(`Unknown real estate type: ${type}`);
  return table;
}

function latestPriceField(type: RealEstateType): 'dealAmount' | 'deposit' {
  return SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
}

function monthlyRentExpression(type: RealEstateType): string {
  return SALE_TYPES.has(type) ? 'CAST(NULL AS SIGNED)' : 'monthlyRent';
}

function numberFromCount(row: CountRow | undefined): number {
  if (!row || row.count === null) return 0;
  return Number(row.count);
}

function parseBatches(report: unknown): SummaryBatchResult[] {
  if (!report || typeof report !== 'object') return [];
  const maybe = (report as { batches?: unknown }).batches;
  if (!Array.isArray(maybe)) return [];
  return maybe.filter((item): item is SummaryBatchResult => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Partial<SummaryBatchResult>;
    return typeof row.type === 'string' && typeof row.city === 'string' && typeof row.rowCount === 'number' && (row.status === 'complete' || row.status === 'failed');
  });
}

async function readState(): Promise<SummaryStateRow | null> {
  const rows = await prisma.$queryRawUnsafe<Array<SummaryStateRow & { reportText: string }>>(
    `SELECT status, runId, sourceFingerprint, CAST(report AS CHAR) AS reportText
     FROM RealEstateSummaryState
     WHERE id = 1`,
  );
  const row = rows[0];
  if (!row) return null;
  let report: unknown = null;
  try {
    report = JSON.parse(row.reportText);
  } catch {
    report = null;
  }
  return { status: row.status, runId: row.runId, sourceFingerprint: row.sourceFingerprint, report };
}

async function writeState(status: SummaryStateRow['status'], runId: string, sourceFingerprint: string, report: unknown, validated: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
     VALUES (1, ?, ?, ?, CAST(? AS JSON), ${validated ? 'NOW(3)' : 'NULL'})
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       runId = VALUES(runId),
       sourceFingerprint = VALUES(sourceFingerprint),
       report = VALUES(report),
       validatedAt = VALUES(validatedAt)`,
    status,
    runId,
    sourceFingerprint,
    JSON.stringify(report),
  );
}

function stateWasEverReady(state: SummaryStateRow | null): boolean {
  if (!state) return false;
  if (state.status === 'ready') return true;
  const lifecycle = state.report && typeof state.report === 'object' ? (state.report as { lifecycle?: { everReady?: unknown } }).lifecycle : undefined;
  return lifecycle?.everReady === true;
}

function reportWithLifecycle(report: SummaryValidationReport, everReady: boolean): SummaryValidationReport & { lifecycle: { everReady: boolean } } {
  return { ...report, lifecycle: { everReady } };
}

async function persistValidationState(report: SummaryValidationReport, everReady: boolean): Promise<void> {
  await writeState(report.complete ? 'ready' : 'failed', report.runId, report.sourceFingerprint || EMPTY_FINGERPRINT, reportWithLifecycle(report, everReady || report.complete), report.complete);
}

function rejectedDirectValidationReport(runId: string, state: SummaryStateRow | null): SummaryValidationReport {
  return {
    runId: state?.runId ?? runId,
    complete: false,
    sourceFingerprint: state?.sourceFingerprint ?? EMPTY_FINGERPRINT,
    missingKeys: 0,
    duplicateKeys: 0,
    mismatchedGroups: 1,
    originalChanged: false,
    batches: parseBatches(state?.report),
  };
}

async function markPreparing(runId: string, sourceFingerprint: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
     VALUES (1, 'preparing', ?, ?, CAST(? AS JSON), NULL)
     ON DUPLICATE KEY UPDATE
       status = 'preparing',
       runId = VALUES(runId),
       sourceFingerprint = VALUES(sourceFingerprint),
       report = VALUES(report),
       validatedAt = NULL`,
    runId,
    sourceFingerprint,
    JSON.stringify({ runId, status: 'preparing', lifecycle: { everReady: false } }),
  );
}

function sourceProjection(table: string, type: RealEstateType, cityScoped: boolean): string {
  const price = latestPriceField(type);
  const monthlyRent = monthlyRentExpression(type);
  return `
    SELECT
      SHA2(CONCAT_WS(CHAR(31), ?, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')), 256) AS buildingKey,
      buildingName,
      bjdCode,
      city,
      district,
      TRIM(dongName) AS dongName,
      NULLIF(TRIM(jibun), '') AS jibun,
      _latestPrice AS latestPrice,
      _monthlyRent AS monthlyRent,
      dealYear AS latestDealYear,
      dealMonth AS latestDealMonth,
      dealDay AS latestDealDay,
      buildYear,
      _lat AS lat,
      _lng AS lng,
      _txCount AS transactionCount
    FROM (
      SELECT
        id,
        city,
        district,
        bjdCode,
        dongName,
        buildingName,
        jibun,
        dealYear,
        dealMonth,
        dealDay,
        buildYear,
        lat,
        lng,
        ${price} AS _latestPrice,
        ${monthlyRent} AS _monthlyRent,
        ROW_NUMBER() OVER (
          PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '')
          ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
        ) AS _rn,
        COUNT(*) OVER (PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '')) AS _txCount,
        FIRST_VALUE(lat) OVER (
          PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '')
          ORDER BY (lat IS NULL OR lng IS NULL) ASC, dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
        ) AS _lat,
        FIRST_VALUE(lng) OVER (
          PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '')
          ORDER BY (lat IS NULL OR lng IS NULL) ASC, dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
        ) AS _lng
      FROM ${table}${cityScoped ? ' WHERE city = ?' : ''}
    ) ranked
    WHERE _rn = 1`;
}

function rawBuildingKeyProjection(table: string): string {
  return `
    SELECT DISTINCT
      SHA2(CONCAT_WS(CHAR(31), ?, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')), 256) AS buildingKey
    FROM ${table}
    WHERE city = ?`;
}

function validationBatchCountsSql(table: string, type: RealEstateType): string {
  return `
    WITH src AS (${sourceProjection(table, type, true)}),
    compared AS (
      SELECT
        v.id AS summaryId,
        v.buildingName AS vBuildingName,
        v.bjdCode AS vBjdCode,
        v.city AS vCity,
        v.district AS vDistrict,
        v.dongName AS vDongName,
        v.jibun AS vJibun,
        v.latestPrice AS vLatestPrice,
        v.monthlyRent AS vMonthlyRent,
        v.latestDealYear AS vLatestDealYear,
        v.latestDealMonth AS vLatestDealMonth,
        v.latestDealDay AS vLatestDealDay,
        v.buildYear AS vBuildYear,
        v.lat AS vLat,
        v.lng AS vLng,
        v.transactionCount AS vTransactionCount,
        src.buildingName AS srcBuildingName,
        src.bjdCode AS srcBjdCode,
        src.city AS srcCity,
        src.district AS srcDistrict,
        src.dongName AS srcDongName,
        src.jibun AS srcJibun,
        src.latestPrice AS srcLatestPrice,
        src.monthlyRent AS srcMonthlyRent,
        src.latestDealYear AS srcLatestDealYear,
        src.latestDealMonth AS srcLatestDealMonth,
        src.latestDealDay AS srcLatestDealDay,
        src.buildYear AS srcBuildYear,
        src.lat AS srcLat,
        src.lng AS srcLng,
        src.transactionCount AS srcTransactionCount
      FROM src
      LEFT JOIN RealEstateBuildingSummaryV2 v
        ON v.type = ? AND v.buildingKey = src.buildingKey
    ),
    raw_keys AS (${rawBuildingKeyProjection(table)})
    SELECT
      COALESCE(SUM(CASE WHEN summaryId IS NULL THEN 1 ELSE 0 END), 0) AS missingKeys,
      COALESCE(SUM(CASE WHEN summaryId IS NOT NULL AND (
        NOT (vBuildingName <=> srcBuildingName)
        OR NOT (vBjdCode <=> srcBjdCode)
        OR NOT (vCity <=> srcCity)
        OR NOT (vDistrict <=> srcDistrict)
        OR NOT (vDongName <=> srcDongName)
        OR NOT (vJibun <=> srcJibun)
        OR NOT (vLatestPrice <=> srcLatestPrice)
        OR NOT (vMonthlyRent <=> srcMonthlyRent)
        OR NOT (vLatestDealYear <=> srcLatestDealYear)
        OR NOT (vLatestDealMonth <=> srcLatestDealMonth)
        OR NOT (vLatestDealDay <=> srcLatestDealDay)
        OR NOT (vBuildYear <=> srcBuildYear)
        OR NOT (vLat <=> srcLat)
        OR NOT (vLng <=> srcLng)
        OR NOT (vTransactionCount <=> srcTransactionCount)
      ) THEN 1 ELSE 0 END), 0) AS mismatchedGroups,
      (
        SELECT COUNT(*)
        FROM RealEstateBuildingSummaryV2 v
        LEFT JOIN raw_keys rk ON rk.buildingKey = v.buildingKey
        WHERE v.type = ? AND v.city = ? AND rk.buildingKey IS NULL
      ) AS extraKeys
    FROM compared`;
}

export function validationBatchCountsSqlForTests(type: RealEstateType): string {
  return validationBatchCountsSql(tableForType(type), type);
}

async function countBatchValidationDrift(type: RealEstateType, city: string): Promise<{ missingKeys: number; mismatchedGroups: number }> {
  const table = tableForType(type);
  const propertyType = propertyTypeForSummary(type);
  const rows = await prisma.$queryRawUnsafe<BatchValidationCountRow[]>(
    validationBatchCountsSql(table, type),
    propertyType,
    city,
    type,
    propertyType,
    city,
    type,
    city,
  );
  const row = rows[0];
  return {
    missingKeys: Number(row?.missingKeys ?? 0),
    mismatchedGroups: Number(row?.mismatchedGroups ?? 0) + Number(row?.extraKeys ?? 0),
  };
}

function rentSplitProjection(table: string): string {
  return `
    SELECT buildingKey,
      MAX(CASE WHEN rentType = '전세' THEN deposit END) AS jeonseDeposit,
      MAX(CASE WHEN rentType = '전세' THEN dealKey END) AS jeonseDealKey,
      MAX(CASE WHEN rentType = '월세' THEN deposit END) AS wolseDeposit,
      MAX(CASE WHEN rentType = '월세' THEN monthlyRent END) AS wolseMonthlyRent,
      MAX(CASE WHEN rentType = '월세' THEN dealKey END) AS wolseDealKey
    FROM (
      SELECT
        SHA2(CONCAT_WS(CHAR(31), ?, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')), 256) AS buildingKey,
        rentType,
        deposit,
        monthlyRent,
        dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1) AS dealKey,
        ROW_NUMBER() OVER (
          PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), ''), rentType
          ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
        ) AS rn
      FROM ${table}
      WHERE city = ?
    ) ranked
    WHERE rn = 1
    GROUP BY buildingKey`;
}

async function countRentSplitMismatches(type: RealEstateType, city: string): Promise<number> {
  if (SALE_TYPES.has(type)) return 0;
  const table = tableForType(type);
  const propertyType = propertyTypeForSummary(type);
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM (${rentSplitProjection(table)}) src
     JOIN RealEstateBuildingSummaryV2 v
       ON v.type = ? AND v.buildingKey = src.buildingKey
     WHERE NOT (v.jeonseDeposit <=> src.jeonseDeposit)
       OR NOT (v.jeonseDealKey <=> src.jeonseDealKey)
       OR NOT (v.wolseDeposit <=> src.wolseDeposit)
       OR NOT (v.wolseMonthlyRent <=> src.wolseMonthlyRent)
       OR NOT (v.wolseDealKey <=> src.wolseDealKey)`,
    propertyType,
    city,
    type,
  );
  return numberFromCount(rows[0]);
}

async function countDuplicateOrInvalidKeys(): Promise<number> {
  const duplicateRows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COALESCE(SUM(duplicateCount), 0) AS count
     FROM (
       SELECT COUNT(*) - 1 AS duplicateCount
       FROM RealEstateBuildingSummaryV2
       GROUP BY type, buildingKey
       HAVING COUNT(*) > 1
     ) duplicates`,
  );
  const invalidRows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM RealEstateBuildingSummaryV2
     WHERE buildingKey IS NULL OR NOT REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c')`,
  );
  return numberFromCount(duplicateRows[0]) + numberFromCount(invalidRows[0]);
}

async function expectedBatches(): Promise<Array<{ type: string; city: string }>> {
  const expected: Array<{ type: string; city: string }> = [];
  for (const type of REAL_ESTATE_TYPES) {
    const table = tableForType(type);
    const rows = await prisma.$queryRawUnsafe<Array<{ city: string | null }>>(
      `SELECT DISTINCT city
       FROM (
         SELECT DISTINCT city FROM ${table} WHERE city IS NOT NULL AND city != ''
         UNION
         SELECT DISTINCT city FROM RealEstateBuildingSummaryV2 WHERE type = ? AND city IS NOT NULL AND city != ''
       ) city_inventory
       ORDER BY city`,
      type,
    );
    expected.push(...rows
      .map((row) => row.city)
      .filter((city): city is string => typeof city === 'string' && city.length > 0)
      .map((city) => ({ type, city })));
  }
  return expected;
}

function batchesAreComplete(batches: SummaryBatchResult[], expected: Array<{ type: string; city: string }>): boolean {
  if (expected.length === 0) return false;
  const complete = new Set(batches.filter((batch) => batch.status === 'complete').map((batch) => `${batch.type}\u0000${batch.city}`));
  return expected.every((batch) => complete.has(`${batch.type}\u0000${batch.city}`)) && batches.every((batch) => batch.status === 'complete');
}

async function sourceRowsForFingerprint(type: RealEstateType, afterId: number): Promise<Array<Record<string, unknown>>> {
  const table = tableForType(type);
  const monthlyRent = SALE_TYPES.has(type) ? 'CAST(NULL AS SIGNED)' : 'monthlyRent';
  const rentType = SALE_TYPES.has(type) ? 'CAST(NULL AS CHAR)' : 'rentType';
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, city, district, bjdCode, dongName, buildingName, buildYear,
            jibun, roadName, lat, lng, dealYear, dealMonth, dealDay,
            ${latestPriceField(type)} AS price, ${monthlyRent} AS monthlyRent, ${rentType} AS rentType
     FROM ${table}
     WHERE id > ?
     ORDER BY id
     LIMIT ${SOURCE_FINGERPRINT_BATCH_SIZE}`,
    afterId,
  );
}

function stableValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toString' in value) return String(value);
  return value;
}

export async function computeRealEstateSourceFingerprint(): Promise<string> {
  const hash = createHash('sha256');
  for (const type of REAL_ESTATE_TYPES) {
    let cursor = 0;
    hash.update(`type:${type}\n`);
    while (true) {
      const rows = await sourceRowsForFingerprint(type, cursor);
      if (rows.length === 0) break;
      for (const row of rows) {
        cursor = Number(row.id);
        const normalized = Object.keys(row).sort().map((key) => [key, stableValue(row[key])]);
        hash.update(`${JSON.stringify(normalized)}\n`);
      }
      if (rows.length < SOURCE_FINGERPRINT_BATCH_SIZE) break;
    }
  }
  return hash.digest('hex');
}

async function validateAddressSummaryInternal(runId: string, options: ValidationOptions = {}): Promise<SummaryValidationReport> {
  const state = await readState();
  const stateBatches = state?.runId === runId ? parseBatches(state.report) : [];
  const batches = options.batches ?? stateBatches;
  const expected = await expectedBatches();
  console.info(`[SummaryV2] validation ${runId}: compare ${expected.length} type/city batches`);
  const duplicateKeys = await countDuplicateOrInvalidKeys();
  let missingKeys = 0;
  let mismatchedGroups = 0;
  for (const batch of expected) {
    const type = batch.type as RealEstateType;
    const drift = await countBatchValidationDrift(type, batch.city);
    missingKeys += drift.missingKeys;
    mismatchedGroups += drift.mismatchedGroups;
    mismatchedGroups += await countRentSplitMismatches(type, batch.city);
  }
  if (beforeFinalFingerprintHookForTests) await beforeFinalFingerprintHookForTests();
  console.info(`[SummaryV2] validation ${runId}: final fingerprint`);
  const sourceFingerprint = await computeRealEstateSourceFingerprint();
  const batchComplete = batchesAreComplete(batches, expected);
  const originalChanged = options.beforeFingerprint ? options.beforeFingerprint !== sourceFingerprint : false;
  const runMatches = !state || state.runId === runId;
  const complete = runMatches && batchComplete && !originalChanged && missingKeys === 0 && duplicateKeys === 0 && mismatchedGroups === 0;
  return { runId, complete, sourceFingerprint, missingKeys, duplicateKeys, mismatchedGroups, originalChanged, batches };
}

export async function validateAddressSummary(runId: string): Promise<SummaryValidationReport> {
  return withRealEstateWriteLock('validateAddressSummary', async () => {
    const state = await readState();
    if (!state || state.runId !== runId) {
      console.info(`[SummaryV2] validate ${runId}: rejected because current state is ${state?.runId ?? 'missing'}`);
      return rejectedDirectValidationReport(runId, state);
    }
    console.info(`[SummaryV2] validate ${runId}: fingerprint before validation`);
    const beforeFingerprint = await computeRealEstateSourceFingerprint();
    const report = await validateAddressSummaryInternal(runId, { beforeFingerprint, batches: parseBatches(state?.report) });
    await persistValidationState(report, stateWasEverReady(state));
    return report;
  });
}

async function prevalidateReportOut(reportOut: string | undefined): Promise<string | undefined> {
  if (!reportOut) return undefined;
  if (!isAbsolute(reportOut)) throw new Error('--report-out must be an absolute path');
  const parent = dirname(reportOut);
  await access(parent, fsConstants.W_OK);
  try {
    const targetStat = await lstat(reportOut);
    if (targetStat.isDirectory()) throw new Error('--report-out must not point to a directory');
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'ENOENT') throw error;
  }
  const probeA = join(parent, `.report-out-probe.${process.pid}.${randomUUID()}.tmp`);
  const probeB = join(parent, `.report-out-probe.${process.pid}.${randomUUID()}.renamed`);
  try {
    await writeFile(probeA, '', { flag: 'wx' });
    await rename(probeA, probeB);
  } finally {
    await rm(probeA, { force: true });
    await rm(probeB, { force: true });
  }
  return reportOut;
}

async function writeReportOut(reportOut: string | undefined, report: SummaryValidationReport): Promise<void> {
  if (!reportOut) return;
  const tmp = join(dirname(reportOut), `.${process.pid}.${randomUUID()}.${reportOut.split('/').pop()}.tmp`);
  await writeFile(tmp, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(tmp, reportOut);
}

export async function prepareRealEstateSummaryV2(options: PrepareOptions = {}): Promise<SummaryValidationReport> {
  const reportOut = await prevalidateReportOut(options.reportOut);
  return withRealEstateWriteLock('prepareRealEstateSummaryV2', async () => {
    const existing = await readState();
    const existingEverReady = stateWasEverReady(existing);
    if (existingEverReady) {
      console.info('[SummaryV2] prepare: previously ready state found, verifying existing run without rebuild');
      const beforeFingerprint = await computeRealEstateSourceFingerprint();
      const report = await validateAddressSummaryInternal(existing?.runId ?? 'missing-state', { beforeFingerprint, batches: parseBatches(existing?.report) });
      await persistValidationState(report, true);
      await writeReportOut(reportOut, report);
      return report;
    }

    const runId = randomUUID();
    console.info(`[SummaryV2] prepare ${runId}: fingerprint before refresh`);
    const beforeFingerprint = await computeRealEstateSourceFingerprint();
    await markPreparing(runId, beforeFingerprint);

    try {
      console.info(`[SummaryV2] prepare ${runId}: refresh batches`);
      const refresh = await refreshAddressSummaries();
      console.info(`[SummaryV2] prepare ${runId}: validate refreshed V2`);
      const report = await validateAddressSummaryInternal(runId, { batches: refresh.batches, beforeFingerprint });
      const finalReport = { ...report, complete: refresh.complete && report.complete };
      await persistValidationState(finalReport, false);
      await writeReportOut(reportOut, finalReport);
      return finalReport;
    } catch (error) {
      const failedReport: SummaryValidationReport = {
        runId,
        complete: false,
        sourceFingerprint: beforeFingerprint,
        missingKeys: 0,
        duplicateKeys: 0,
        mismatchedGroups: 1,
        originalChanged: false,
        batches: [{ type: '*', city: '*', rowCount: 0, status: 'failed', error: error instanceof Error ? error.message : String(error) }],
      };
      await writeState('failed', runId, beforeFingerprint || EMPTY_FINGERPRINT, reportWithLifecycle(failedReport, false), false);
      await writeReportOut(reportOut, failedReport);
      throw error;
    }
  });
}

export async function verifyRealEstateSummaryV2(options: VerifyOptions = {}): Promise<SummaryValidationReport> {
  const reportOut = await prevalidateReportOut(options.reportOut);
  return withRealEstateWriteLock('verifyRealEstateSummaryV2', async () => {
    const state = await readState();
    if (!state) {
      console.info('[SummaryV2] verify missing-state: rejected because current state is missing');
      const report = rejectedDirectValidationReport('missing-state', null);
      await writeReportOut(reportOut, report);
      return report;
    }
    const runId = state.runId;
    console.info(`[SummaryV2] verify ${runId}: fingerprint before validation`);
    const beforeFingerprint = await computeRealEstateSourceFingerprint();
    const report = await validateAddressSummaryInternal(runId, { beforeFingerprint, batches: parseBatches(state?.report) });
    await persistValidationState(report, stateWasEverReady(state));
    await writeReportOut(reportOut, report);
    return report;
  });
}
