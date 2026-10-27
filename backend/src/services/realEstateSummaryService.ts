import { prisma } from '../lib/prisma.js';
import { readSummaryMode, type SummaryReadMode } from '../lib/realEstateSummaryStore.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';
import { refreshLegacySummariesUnlocked } from './realEstateLegacySummaryService.js';
import { appendRealEstateUrlsForSummaryBatch } from './realEstateUrlRegistry.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
// buildYear 컬럼이 없는 타입
const NO_BUILD_YEAR_TYPES = new Set<string>();

// Each address batch has its own transaction; this limit does not cancel MySQL DML.
// Keep the sorted input small instead of relying on the timeout to bound resource use.
const BATCH_TX_TIMEOUT_MS = 300_000;

// InnoDB 락 대기 한도(초). 경합이 오래 가지 않도록 짧게 두어 실패 시 다음 city로 바로 넘어감.
const LOCK_WAIT_TIMEOUT_SEC = 15;

export interface SummaryBatchResult {
  type: string;
  city: string;
  rowCount: number;
  status: 'complete' | 'failed';
  error?: string;
}

export interface SummaryRefreshResult {
  batches: SummaryBatchResult[];
  complete: boolean;
}

type SummaryRefreshEnv = typeof process.env;

function batchPauseMs(): number {
  if (process.env.NODE_ENV === 'test') return 0;
  const raw = process.env.SUMMARY_BATCH_PAUSE_MS;
  if (raw === undefined || raw === '') return 250;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new Error('Invalid SUMMARY_BATCH_PAUSE_MS');
  return value;
}

function batchTimeoutMs(): number {
  const raw = process.env.SUMMARY_BATCH_TIMEOUT_MS;
  if (raw === undefined || raw === '') return BATCH_TX_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 1_800_000) throw new Error('Invalid SUMMARY_BATCH_TIMEOUT_MS');
  return value;
}

interface CodeInventoryRow {
  bjdCode: string;
  sourceCount: bigint | number;
}

function batchMaxRows(): number {
  const raw = process.env.SUMMARY_BATCH_MAX_ROWS;
  if (raw === undefined || raw === '') return 25_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 50_000) throw new Error('Invalid SUMMARY_BATCH_MAX_ROWS');
  return value;
}

// A code is indivisible: every transaction for a building must enter the same
// window. One oversized code runs alone; the row target is not a hard SQL limit.
function groupCodes(rows: CodeInventoryRow[], maxRows: number): CodeInventoryRow[][] {
  const batches: CodeInventoryRow[][] = [];
  let current: CodeInventoryRow[] = [];
  let count = 0;
  for (const row of rows) {
    const size = Number(row.sourceCount);
    if (typeof row.bjdCode !== 'string' || !Number.isSafeInteger(size) || size < 0) {
      throw new Error('Invalid summary code inventory');
    }
    if (current.length > 0 && (count + size > maxRows || current.length >= 200)) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(row);
    count += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * 전월세 요약 행의 전세/월세 분리 컬럼을 채우는 UPDATE.
 *
 * 왜 INSERT 에 통합하지 않는가: 통합하면 `SELECT *` 가 윈도우 두 겹을 통과해 넓은 행
 * 집합을 두 번 실체화한다. 로컬 운영 스냅샷 실측(경기 apt-rent 67,477행) —
 * 현행 INSERT 3.13s / 통합 8.87s(2.8배) / 이 경량 UPDATE 0.58s. 결과 건수는 셋 다 6,218 로 동일.
 * 배치당 증가분이 2.8배가 아니라 약 18% 로 줄고, 문장이 짧게 둘로 나뉘어 락 점유 시간도
 * 통합안보다 짧다. 2026-04-18 에 단일 INSERT 가 버퍼풀을 10분 점유해 사이트를
 * 무한로딩시킨 이력이 있어 INSERT와 분리 UPDATE 구조를 유지한다.
 *
 * rn=1 로 rentType 별 최신 1건을 고른 뒤 MAX(CASE ...) 로 건물당 한 행에 접는다.
 * 여기서 MAX 는 크기 비교가 아니라 그룹당 후보가 1개뿐인 상태에서의 접기 용도다.
 */
function buildRentSplitUpdate(table: string, summaryTable: string, codePlaceholders: string): string {
  return `UPDATE ${summaryTable} s
    JOIN (
      SELECT buildingName, bjdCode, dongKey, jibunKey,
        MAX(CASE WHEN rentType = '전세' THEN deposit END)     AS jDeposit,
        MAX(CASE WHEN rentType = '전세' THEN dealKey END)     AS jDealKey,
        MAX(CASE WHEN rentType = '월세' THEN deposit END)     AS wDeposit,
        MAX(CASE WHEN rentType = '월세' THEN monthlyRent END) AS wMonthly,
        MAX(CASE WHEN rentType = '월세' THEN dealKey END)     AS wDealKey
      FROM (
        SELECT buildingName, bjdCode, TRIM(dongName) AS dongKey, COALESCE(TRIM(jibun), '') AS jibunKey,
          rentType, deposit, monthlyRent,
          dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1) AS dealKey,
          ROW_NUMBER() OVER (
            PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), ''), rentType
            ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
          ) AS rn
        FROM ${table}
        WHERE city = ? AND bjdCode IN (${codePlaceholders})
      ) ranked
      WHERE rn = 1
      GROUP BY buildingName, bjdCode, dongKey, jibunKey
    ) t ON t.buildingName = s.buildingName
      AND t.bjdCode = s.bjdCode
      AND t.dongKey = TRIM(s.dongName)
      AND t.jibunKey = COALESCE(TRIM(s.jibun), '')
    SET s.jeonseDeposit    = t.jDeposit,
        s.jeonseDealKey    = t.jDealKey,
        s.wolseDeposit     = t.wDeposit,
        s.wolseMonthlyRent = t.wMonthly,
        s.wolseDealKey     = t.wDealKey
    WHERE s.type = ? AND s.city = ? AND s.bjdCode IN (${codePlaceholders})`;
}

function propertyTypeForSummary(type: string): string {
  return type.split('-')[0] ?? type;
}

/**
 * Refresh city/code batches atomically, including rent splits and URL mappings.
 * City-wide window sorts exhausted MySQL /tmp on the production apt-rent table.
 * bjdCode is part of building identity, unlike the display district name, so
 * partitioning by code preserves complete histories, latest prices and coordinates.
 */
async function refreshAddressSummaryType(type: string): Promise<SummaryBatchResult[]> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
  const buildYearCol = NO_BUILD_YEAR_TYPES.has(type) ? 'NULL' : 'buildYear';
  const propertyType = propertyTypeForSummary(type);
  const monthlyRentCol = SALE_TYPES.has(type) ? 'NULL' : 'monthlyRent';
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
  const cities = rows.map((r) => r.city).filter((c): c is string => typeof c === 'string' && c.length > 0);
  const batches: SummaryBatchResult[] = [];
  const maxRows = batchMaxRows();

  for (const city of cities) {
    let rowCount = 0;
    const failures: string[] = [];
    try {
      const inventory = await prisma.$queryRawUnsafe<CodeInventoryRow[]>(
        `SELECT bjdCode, SUM(sourceCount) AS sourceCount FROM (
           SELECT bjdCode, COUNT(*) AS sourceCount FROM ${table} WHERE city = ? GROUP BY bjdCode
           UNION ALL
           SELECT DISTINCT bjdCode, 0 AS sourceCount FROM RealEstateBuildingSummaryV2 WHERE type = ? AND city = ?
         ) code_inventory GROUP BY bjdCode ORDER BY bjdCode`,
        city, type, city,
      );
      for (const codeRows of groupCodes(inventory, maxRows)) {
        const codes = codeRows.map((row) => row.bjdCode);
        const codePlaceholders = codes.map(() => '?').join(', ');
        const started = Date.now();
        const scope = `${type}/${city}/${codes[0]}..${codes[codes.length - 1]}`;
        const sourceRows = codeRows.reduce((sum, row) => sum + Number(row.sourceCount), 0);
        console.info(`[SummaryV2] ${scope} start sourceRows=${sourceRows}`);
        try {
          const inserted = await prisma.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SEC}`);
              await tx.$executeRawUnsafe(
                `DELETE FROM RealEstateBuildingSummaryV2 WHERE type = ? AND city = ? AND bjdCode IN (${codePlaceholders})`,
                type,
                city,
                ...codes,
              );
              const n = await tx.$executeRawUnsafe(
                `INSERT INTO RealEstateBuildingSummaryV2
                  (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun,
                   latestPrice, monthlyRent,
                   latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng,
                   transactionCount, updatedAt)
                SELECT
                  ? AS type,
                  SHA2(CONCAT_WS(CHAR(31), ?, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')), 256) AS buildingKey,
                  buildingName, bjdCode, city, district, TRIM(dongName) AS dongName, NULLIF(TRIM(jibun), '') AS jibun,
                  ${priceField} AS latestPrice,
                  ${monthlyRentCol} AS monthlyRent,
                  dealYear AS latestDealYear, dealMonth AS latestDealMonth, dealDay AS latestDealDay,
                  ${buildYearCol} AS buildYear,
                  _lat AS lat,
                  _lng AS lng,
                  _txCount AS transactionCount,
                  NOW()
                FROM (
                  SELECT id, buildingName, bjdCode, city, district, dongName, jibun,
                    ${priceField}, ${SALE_TYPES.has(type) ? '' : 'monthlyRent,'}
                    dealYear, dealMonth, dealDay, ${buildYearCol} AS buildYear, lat, lng,
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
                  FROM ${table}
                  WHERE city = ? AND bjdCode IN (${codePlaceholders})
                ) ranked
                WHERE _rn = 1`,
                type,
                propertyType,
                city,
                ...codes,
              );
              if (!SALE_TYPES.has(type)) {
                await tx.$executeRawUnsafe(buildRentSplitUpdate(table, 'RealEstateBuildingSummaryV2', codePlaceholders), city, ...codes, type, city, ...codes);
              }
              await appendRealEstateUrlsForSummaryBatch(tx, type, city, process.env, { bjdCodes: codes });
              return Number(n) || 0;
            },
            { timeout: batchTimeoutMs() },
          );
          rowCount += inserted;
          console.info(`[SummaryV2] ${scope} complete rows=${inserted} elapsedMs=${Date.now() - started}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[SummaryV2] ${scope} 실패:`, error);
          failures.push(`${scope}: ${message}`);
        }
        const pause = batchPauseMs();
        if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SummaryV2] ${type}/${city} 실패:`, error);
      failures.push(message);
    }
    batches.push({ type, city, rowCount, status: failures.length > 0 ? 'failed' : 'complete',
      ...(failures.length > 0 ? { error: failures.join('; ') } : {}),
    });
  }

  return batches;
}

export async function refreshAddressSummariesUnlocked(types: string[] = Object.keys(TABLE_NAME_MAP)): Promise<SummaryRefreshResult> {
  const batches: SummaryBatchResult[] = [];
  for (const type of types) {
    try {
      batches.push(...await refreshAddressSummaryType(type));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SummaryV2] ${type} city inventory failed:`, error);
      batches.push({ type, city: '*', rowCount: 0, status: 'failed', error: message });
    }
  }
  return { batches, complete: batches.every((batch) => batch.status === 'complete') };
}

export async function refreshAddressSummaries(types: string[] = Object.keys(TABLE_NAME_MAP)): Promise<SummaryRefreshResult> {
  return withRealEstateWriteLock('refreshAddressSummaries', () => refreshAddressSummariesUnlocked(types));
}

export async function refreshSummariesForModeUnlocked(
  mode: SummaryReadMode,
  types: string[] = Object.keys(TABLE_NAME_MAP),
): Promise<SummaryRefreshResult> {
  if (mode === 'address') {
    return refreshAddressSummariesUnlocked(types);
  }

  const address = await refreshAddressSummariesUnlocked(types);
  const legacy = await refreshLegacySummariesUnlocked(types);

  return {
    batches: [...address.batches, ...legacy.batches],
    complete: address.complete && legacy.complete,
  };
}

export async function refreshSummariesForActiveMode(
  types: string[] = Object.keys(TABLE_NAME_MAP),
  env: SummaryRefreshEnv = process.env,
): Promise<SummaryRefreshResult> {
  const mode = readSummaryMode(env);
  return withRealEstateWriteLock('refreshRealEstateSummaries', () => refreshSummariesForModeUnlocked(mode, types));
}

export async function refreshSummary(type: string): Promise<number> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);
  const result = await refreshAddressSummariesUnlocked([type]);
  return result.batches
    .filter((batch) => batch.status === 'complete')
    .reduce((sum, batch) => sum + batch.rowCount, 0);
}


/**
 * 모든 타입의 Summary 갱신. 한 타입이 실패해도 다음 타입으로 계속 진행.
 */
export interface RefreshAllResult {
  /** 갱신에 성공한 타입 */
  done: RealEstateType[];
  /** 예외로 실패한 타입 */
  failed: RealEstateType[];
  /** 전체 타입 수 — 호출부가 "N/M" 을 찍을 때 쓴다 */
  total: number;
}

/**
 * 모든 타입의 Summary 갱신. 한 타입이 실패해도 다음 타입으로 계속 진행한다.
 *
 * 결과를 **반환**하는 이유: 종전에는 void 라 호출부가 완주 여부를 알 수 없었고,
 * 실패해도 console.error 한 줄만 남아 Actions UI 에는 success 로 보였다.
 * 실제 사고 — 2026-08-08·08-09 야간 sync 에서 바깥 `timeout` 이 스크립트를 죽여
 * villa-rent·offitel 이 안 돌았는데 워크플로는 두 번 다 success 로 끝났다.
 * (그 경우는 프로세스가 통째로 죽어 이 함수가 반환조차 못 하므로, 호출부가
 *  종료 코드로도 판정해야 한다 — refreshRealEstateSummary.ts 참고.)
 */
export async function refreshAllSummaries(): Promise<RefreshAllResult> {
  const types = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
  const result = await refreshSummariesForActiveMode(types);
  const failedSet = new Set(result.batches.filter((batch) => batch.status === 'failed').map((batch) => batch.type as RealEstateType));
  const done = types.filter((type) => !failedSet.has(type));
  const failed = types.filter((type) => failedSet.has(type));
  const mode = readSummaryMode(process.env);
  for (const type of done) console.info(`[Summary] ${type}: ${mode} summaries refreshed`);
  for (const type of failed) console.error(`[Summary] ${type} 실패`);
  return { done, failed, total: types.length };
}
