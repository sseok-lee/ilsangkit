import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import {
  hashRealEstatePublicPath,
  isDeferredRealEstateUrlEvidence,
  planRealEstatePublicUrls,
  type ExistingRealEstateUrlMapping,
  type LegacyRealEstateUrlBaselineEntry,
  type PlannedRealEstatePublicUrl,
  type RealEstateUrlCandidate,
} from '../lib/realEstateUrlPlan.js';

const READ_BATCH_SIZE = 10_000;
const INSERT_BATCH_SIZE = 500;

interface CliOptions {
  unresolvedPolicy: 'block' | 'defer';
  apply: boolean;
  resolveDeferred: boolean;
  baselinePath: string | null;
  expectedFingerprint: string | null;
  expectedPlanFingerprint: string | null;
  reportOut: string | null;
  planOut: string | null;
}

interface BaselineFile {
  provenance: string;
  entries: LegacyRealEstateUrlBaselineEntry[];
}

export interface RealEstateUrlRegistryReport {
  unresolvedPolicy: 'block' | 'defer';
  resolveDeferred: boolean;
  deferred: Array<{ kind: string; basePath: string; buildingKeys: string[]; detail?: string }>;
  deferredMappings: number;
  deferredGroups: number;
  applied: boolean;
  sourceFingerprint: string;
  planFingerprint: string;
  baselineProvenance: string | null;
  existing: number;
  candidates: number;
  mappings: number;
  toCreate: number;
  toUpdate: number;
  blockers: Array<{ kind: string; basePath: string; buildingKeys: string[]; detail?: string }>;
}

type PrismaExecutor = Pick<typeof prisma, '$queryRawUnsafe' | '$executeRawUnsafe'>;

type ExistingRegistryRow = ExistingRealEstateUrlMapping & {
  basePathHash?: string | null;
};

export function parseRealEstateUrlArgs(args: string[]): CliOptions {
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run') || !apply;
  const resolveDeferred = args.includes('--resolve-deferred');
  const baselinePath = readValueArg(args, '--baseline');
  const expectedFingerprint = readValueArg(args, '--expected-fingerprint');
  const expectedPlanFingerprint = readValueArg(args, '--expected-plan-fingerprint');
  const reportOut = readValueArg(args, '--report-out');
  const planOut = readValueArg(args, '--plan-out');
  const unresolvedPolicy = readValueArg(args, '--unresolved-policy') ?? 'block';
  if (unresolvedPolicy !== 'block' && unresolvedPolicy !== 'defer') {
    throw new Error('--unresolved-policy must be block or defer');
  }

  if (apply && !baselinePath) throw new Error('--baseline is required with --apply');
  if (apply && !expectedFingerprint)
    throw new Error('--expected-fingerprint is required with --apply');
  if (apply && !expectedPlanFingerprint)
    throw new Error('--expected-plan-fingerprint is required with --apply');
  if (resolveDeferred && !baselinePath)
    throw new Error('--baseline is required with --resolve-deferred');
  if (!apply && !dryRun) throw new Error('Use --dry-run or --apply');
  return {
    apply,
    resolveDeferred,
    baselinePath,
    expectedFingerprint,
    expectedPlanFingerprint,
    reportOut,
    planOut,
    unresolvedPolicy,
  };
}

export async function runRealEstateUrlRegistryCli(
  args = process.argv.slice(2)
): Promise<RealEstateUrlRegistryReport> {
  const options = parseRealEstateUrlArgs(args);
  const baseline = options.baselinePath ? await readBaseline(options.baselinePath) : null;
  if (options.resolveDeferred && baseline?.entries.some((entry) => !entry.provenance?.trim())) {
    throw new Error('Every baseline entry must include provenance with --resolve-deferred');
  }
  if (options.apply) {
    return withRealEstateWriteLock('realEstateUrls:apply', () =>
      runRealEstateUrlRegistryPlan(options, baseline)
    );
  }
  return runRealEstateUrlRegistryPlan(options, baseline);
}

async function runRealEstateUrlRegistryPlan(
  options: CliOptions,
  baseline: BaselineFile | null
): Promise<RealEstateUrlRegistryReport> {
  const [existing, current] = await Promise.all([
    readExistingMappings(!options.apply),
    readCurrentCandidates(),
  ]);
  const sourceFingerprint = fingerprintInputs(current, baseline?.entries ?? []);
  if (options.expectedFingerprint && options.expectedFingerprint !== sourceFingerprint) {
    throw new Error(
      `Fingerprint mismatch: expected ${options.expectedFingerprint}, got ${sourceFingerprint}`
    );
  }

  const plan = planRealEstatePublicUrls({
    unresolvedPolicy: options.unresolvedPolicy,
    resolveDeferred: options.resolveDeferred,
    existing,
    current,
    legacyBaseline: baseline?.entries ?? [],
    baselineProvenance: baseline?.provenance ?? null,
    sourceFingerprint,
    generatedAt: new Date(),
  });
  const planFingerprint = fingerprintPlan(plan.mappings);
  const deferredMappings = plan.mappings.filter((row) =>
    isDeferredRealEstateUrlEvidence(row.evidence)
  );
  const deferredGroups = new Set(deferredMappings.map((row) => row.basePath)).size;
  if (options.expectedPlanFingerprint && options.expectedPlanFingerprint !== planFingerprint) {
    throw new Error(
      `Plan fingerprint mismatch: expected ${options.expectedPlanFingerprint}, got ${planFingerprint}`
    );
  }

  if (options.apply) {
    if (!baseline?.provenance)
      throw new Error('Explicit baseline provenance is required with --apply');
    if (plan.blockers.length > 0)
      throw new Error(`Cannot apply with ${plan.blockers.length} unresolved URL blockers`);
    const beforeWrite = await readCurrentCandidates();
    const beforeWriteFingerprint = fingerprintInputs(beforeWrite, baseline.entries);
    if (beforeWriteFingerprint !== sourceFingerprint) {
      throw new Error(
        `Source fingerprint changed before apply: expected ${sourceFingerprint}, got ${beforeWriteFingerprint}`
      );
    }
    if (plan.toUpdate.length > 0) {
      await writePreparingState({
        sourceFingerprint,
        baselineProvenance: baseline.provenance,
        report: {
          unresolvedPolicy: options.unresolvedPolicy,
          resolveDeferred: options.resolveDeferred,
          deferred: plan.deferred,
          deferredMappings: deferredMappings.length,
          deferredGroups,
          existing: existing.length,
          candidates: current.length,
          mappings: plan.mappings.length,
          toCreate: plan.toCreate.length,
          toUpdate: plan.toUpdate.length,
          blockers: plan.blockers,
        },
      });
    }
    await updateDeferredMappings(plan.toUpdate, existing);
    await insertMappings(plan.toCreate);
    await verifyPersistedMappings(plan.toCreate);
    await verifyPersistedMappings(plan.toUpdate, { requireResolved: true });
    await writeReadyState({
      sourceFingerprint,
      baselineProvenance: baseline.provenance,
      report: {
        unresolvedPolicy: options.unresolvedPolicy,
        resolveDeferred: options.resolveDeferred,
        deferred: plan.deferred,
        deferredMappings: deferredMappings.length,
        deferredGroups,
        existing: existing.length,
        candidates: current.length,
        mappings: plan.mappings.length,
        toCreate: plan.toCreate.length,
        toUpdate: plan.toUpdate.length,
        blockers: plan.blockers,
      },
    });
  }

  const report: RealEstateUrlRegistryReport = {
    unresolvedPolicy: options.unresolvedPolicy,
    resolveDeferred: options.resolveDeferred,
    deferred: plan.deferred,
    deferredMappings: deferredMappings.length,
    deferredGroups,
    applied: options.apply,
    sourceFingerprint,
    planFingerprint,
    baselineProvenance: baseline?.provenance ?? null,
    existing: existing.length,
    candidates: current.length,
    mappings: plan.mappings.length,
    toCreate: plan.toCreate.length,
    toUpdate: plan.toUpdate.length,
    blockers: plan.blockers,
  };
  if (options.planOut) await writePlanRows(options.planOut, plan.mappings);
  if (options.reportOut)
    await writeFile(resolve(options.reportOut), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function readBaseline(path: string): Promise<BaselineFile> {
  const parsed = JSON.parse(await readFile(resolve(path), 'utf8')) as BaselineFile;
  if (!parsed.provenance || !Array.isArray(parsed.entries)) {
    throw new Error('Baseline JSON must include provenance and entries[]');
  }
  return parsed;
}

async function readExistingMappings(allowMissingTable: boolean): Promise<ExistingRegistryRow[]> {
  const rows: ExistingRegistryRow[] = [];
  let lastId = 0;
  try {
    // Bound the Prisma result buffer as well as the JS allocations during decoding.
    for (;;) {
      const batch = await prisma.$queryRawUnsafe<Array<ExistingRegistryRow & { id: number }>>(
        `SELECT id, type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, basePathHash, dongName, jibun, evidence
           FROM RealEstatePublicUrl
          WHERE id > ?
          ORDER BY id
          LIMIT ?`,
        lastId,
        READ_BATCH_SIZE
      );
      if (batch.length === 0) break;
      rows.push(...batch.map(({ id: _id, ...row }) => row));
      lastId = batch[batch.length - 1].id;
    }
    return rows;
  } catch (error) {
    if (allowMissingTable && rows.length === 0 && isMissingTableError(error)) return [];
    throw error;
  }
}

async function readCurrentCandidates(): Promise<RealEstateUrlCandidate[]> {
  const rows: RealEstateUrlCandidate[] = [];
  let lastId = 0;
  for (;;) {
    const batch = await prisma.$queryRawUnsafe<Array<RealEstateUrlCandidate & { id: number }>>(
      `SELECT id, type, buildingKey, bjdCode, city, district, buildingName, dongName, jibun
         FROM RealEstateBuildingSummaryV2
        WHERE id > ?
        ORDER BY id
        LIMIT ?`,
      lastId,
      READ_BATCH_SIZE
    );
    if (batch.length === 0) break;
    rows.push(...batch.map(({ id: _id, ...row }) => row));
    lastId = batch[batch.length - 1].id;
  }
  return rows;
}

async function insertMappings(rows: PlannedRealEstatePublicUrl[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    if (batch.length === 0) continue;
    const values = batch
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?)')
      .join(', ');
    const params = batch.flatMap((row) => [
      row.type,
      row.buildingKey,
      row.bjdCode,
      row.buildingName,
      row.basePath,
      row.basePathHash,
      row.canonicalPath,
      row.pathHash,
      row.dongName,
      row.jibun,
      JSON.stringify(row.addressSnapshot),
      JSON.stringify(row.evidence),
      row.sourceFingerprint,
      row.baselineProvenance,
    ]);
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`RealEstatePublicUrl\`
        (type, buildingKey, bjdCode, buildingName, basePath, basePathHash, canonicalPath, pathHash, dongName, jibun, addressSnapshot, evidence, sourceFingerprint, baselineProvenance)
       VALUES ${values}`,
      ...params
    );
  }
}

async function updateDeferredMappings(
  rows: PlannedRealEstatePublicUrl[],
  existing: ExistingRegistryRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const existingByKey = new Map(existing.map((row) => [`${row.type}\x1f${row.buildingKey}`, row]));
  const groups = groupRows(rows, (row) => `${row.type}\x1f${row.basePath}`);
  for (const group of groups.values()) {
    await prisma.$transaction(async (tx) => {
      await updateDeferredMappingGroup(tx as PrismaExecutor, group, existingByKey);
    });
  }
}

async function updateDeferredMappingGroup(
  tx: PrismaExecutor,
  rows: PlannedRealEstatePublicUrl[],
  existingByKey: Map<string, ExistingRegistryRow>
): Promise<void> {
  const first = rows[0];
  const expectedKeys = new Set(rows.map((row) => `${row.type}\x1f${row.buildingKey}`));
  const captured = rows.map((row) => {
    const existing = existingByKey.get(`${row.type}\x1f${row.buildingKey}`);
    if (!existing) {
      throw new Error(
        `Deferred URL mapping missing from captured registry for ${row.type}:${row.buildingKey}`
      );
    }
    return existing;
  });
  const basePathHash = captured[0]?.basePathHash ?? hashRealEstatePublicPath(first.basePath);
  const locked = await tx.$queryRawUnsafe<Array<ExistingRegistryRow>>(
    `SELECT type, buildingKey, bjdCode, buildingName, canonicalPath, basePath, basePathHash, dongName, jibun, evidence
       FROM RealEstatePublicUrl
      WHERE type = ? AND basePathHash = ?
      FOR UPDATE`,
    first.type,
    basePathHash
  );
  if (locked.length !== captured.length) {
    throw new Error(
      `Real estate URL group changed before deferred resolution: ${first.type}:${first.basePath}`
    );
  }
  const lockedByKey = new Map(locked.map((row) => [`${row.type}\x1f${row.buildingKey}`, row]));
  for (const capturedRow of captured) {
    const key = `${capturedRow.type}\x1f${capturedRow.buildingKey}`;
    if (!expectedKeys.has(key)) {
      throw new Error(
        `Unexpected deferred URL mapping captured for ${capturedRow.type}:${capturedRow.buildingKey}`
      );
    }
    const lockedRow = lockedByKey.get(key);
    if (!lockedRow || !sameRegistryRow(lockedRow, capturedRow)) {
      throw new Error(
        `Real estate URL group changed before deferred resolution: ${capturedRow.type}:${capturedRow.buildingKey}`
      );
    }
    if (!isDeferredRealEstateUrlEvidence(lockedRow.evidence)) {
      throw new Error(
        `Real estate URL group is no longer deferred: ${capturedRow.type}:${capturedRow.buildingKey}`
      );
    }
  }
  for (const row of rows) {
    const updated = await tx.$executeRawUnsafe(
      `UPDATE \`RealEstatePublicUrl\`
          SET bjdCode = ?,
              buildingName = ?,
              basePath = ?,
              basePathHash = ?,
              canonicalPath = ?,
              pathHash = ?,
              dongName = ?,
              jibun = ?,
              addressSnapshot = CAST(? AS JSON),
              evidence = CAST(? AS JSON),
              sourceFingerprint = ?,
              baselineProvenance = ?,
              updatedAt = NOW(3)
        WHERE type = ? AND buildingKey = ?`,
      row.bjdCode,
      row.buildingName,
      row.basePath,
      row.basePathHash,
      row.canonicalPath,
      row.pathHash,
      row.dongName,
      row.jibun,
      JSON.stringify(row.addressSnapshot),
      JSON.stringify(row.evidence),
      row.sourceFingerprint,
      row.baselineProvenance,
      row.type,
      row.buildingKey
    );
    if (typeof updated === 'number' && updated !== 1) {
      throw new Error(
        `Deferred URL mapping update affected ${updated} rows for ${row.type}:${row.buildingKey}`
      );
    }
  }
}

async function verifyPersistedMappings(
  rows: PlannedRealEstatePublicUrl[],
  options: { requireResolved?: boolean } = {}
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    const predicates = batch.map(() => '(type = ? AND buildingKey = ?)').join(' OR ');
    const params = batch.flatMap((row) => [row.type, row.buildingKey]);
    const persisted = await prisma.$queryRawUnsafe<
      Array<{
        type: string;
        buildingKey: string;
        canonicalPath: string;
        basePath: string;
        evidence: unknown;
      }>
    >(
      `SELECT type, buildingKey, canonicalPath, basePath, evidence FROM RealEstatePublicUrl WHERE ${predicates}`,
      ...params
    );
    const persistedByKey = new Map(
      persisted.map((row) => [`${row.type}\x1f${row.buildingKey}`, row])
    );
    for (const row of batch) {
      const actual = persistedByKey.get(`${row.type}\x1f${row.buildingKey}`);
      if (
        !actual ||
        actual.canonicalPath !== row.canonicalPath ||
        actual.basePath !== row.basePath
      ) {
        throw new Error(`Persisted URL mapping mismatch for ${row.type}:${row.buildingKey}`);
      }
      if (options.requireResolved && isDeferredRealEstateUrlEvidence(actual.evidence)) {
        throw new Error(
          `Persisted URL mapping is still deferred for ${row.type}:${row.buildingKey}`
        );
      }
    }
  }
}

async function writePreparingState(input: {
  sourceFingerprint: string;
  baselineProvenance: string;
  report: Record<string, unknown>;
}): Promise<void> {
  await writeUrlState('preparing', input);
}

async function writeReadyState(input: {
  sourceFingerprint: string;
  baselineProvenance: string;
  report: Record<string, unknown>;
}): Promise<void> {
  await writeUrlState('ready', input);
}

async function writeUrlState(
  status: 'preparing' | 'ready',
  input: {
    sourceFingerprint: string;
    baselineProvenance: string;
    report: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`RealEstatePublicUrlState\`
       (id, status, sourceFingerprint, baselineProvenance, report, validatedAt)
     VALUES (1, ?, ?, ?, CAST(? AS JSON), ${status === 'ready' ? 'NOW(3)' : 'NULL'})
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       sourceFingerprint = VALUES(sourceFingerprint),
       baselineProvenance = VALUES(baselineProvenance),
       report = VALUES(report),
       validatedAt = VALUES(validatedAt)`,
    status,
    input.sourceFingerprint,
    input.baselineProvenance,
    JSON.stringify(input.report)
  );
}

function sameRegistryRow(actual: ExistingRegistryRow, expected: ExistingRegistryRow): boolean {
  return (
    actual.type === expected.type &&
    actual.buildingKey === expected.buildingKey &&
    actual.bjdCode === expected.bjdCode &&
    actual.buildingName === expected.buildingName &&
    actual.canonicalPath === expected.canonicalPath &&
    actual.basePath === expected.basePath &&
    (actual.basePathHash ?? null) === (expected.basePathHash ?? null) &&
    sameNullableText(actual.dongName, expected.dongName) &&
    sameNullableText(actual.jibun, expected.jibun) &&
    stableJson(actual.evidence) === stableJson(expected.evidence)
  );
}

function sameNullableText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function groupRows<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function fingerprintInputs(
  current: RealEstateUrlCandidate[],
  baseline: LegacyRealEstateUrlBaselineEntry[]
): string {
  const stable = {
    current: [...current]
      .map((row) => ({
        type: row.type,
        buildingKey: row.buildingKey,
        bjdCode: row.bjdCode,
        city: row.city,
        district: row.district,
        buildingName: row.buildingName.normalize('NFC'),
        dongName: row.dongName?.normalize('NFC') ?? null,
        jibun: row.jibun?.normalize('NFC') ?? null,
      }))
      .sort((a, b) => `${a.type}:${a.buildingKey}`.localeCompare(`${b.type}:${b.buildingKey}`)),
    baseline: [...baseline]
      .map((row) => ({
        type: row.type,
        basePath: row.basePath.normalize('NFC'),
        dongName: row.dongName?.normalize('NFC') ?? null,
        jibun: row.jibun?.normalize('NFC') ?? null,
        provenance: row.provenance,
      }))
      .sort((a, b) =>
        `${a.type}:${a.basePath}:${a.dongName}:${a.jibun}`.localeCompare(
          `${b.type}:${b.basePath}:${b.dongName}:${b.jibun}`
        )
      ),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function fingerprintPlan(rows: PlannedRealEstatePublicUrl[]): string {
  const stable = rows
    .map((row) => ({
      type: row.type,
      buildingKey: row.buildingKey,
      basePath: row.basePath,
      canonicalPath: row.canonicalPath,
      legacyGrouped: isDeferredRealEstateUrlEvidence(row.evidence),
    }))
    .sort((a, b) => `${a.type}:${a.buildingKey}`.localeCompare(`${b.type}:${b.buildingKey}`));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

async function writePlanRows(path: string, rows: PlannedRealEstatePublicUrl[]): Promise<void> {
  const lines = rows
    .map((row) =>
      JSON.stringify({
        type: row.type,
        buildingKey: row.buildingKey,
        basePath: row.basePath,
        canonicalPath: row.canonicalPath,
        dongName: row.dongName,
        jibun: row.jibun,
        evidence: row.evidence,
      })
    )
    .join('\n');
  await writeFile(resolve(path), lines ? `${lines}\n` : '');
}

function isMissingTableError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    (code === 'P2010' && message.includes('1146')) ||
    (message.includes("doesn't exist") && message.includes('RealEstatePublicUrl'))
  );
}

function readValueArg(args: string[], name: string): string | null {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  runRealEstateUrlRegistryCli()
    .then((report) => {
      console.info(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
