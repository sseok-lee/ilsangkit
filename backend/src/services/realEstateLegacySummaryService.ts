import { prisma } from '../lib/prisma.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { TABLE_NAME_MAP } from './realEstateService.js';
import type { SummaryBatchResult, SummaryRefreshResult } from './realEstateSummaryService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
const NO_BUILD_YEAR_TYPES = new Set<string>();
const LOCK_WAIT_TIMEOUT_SEC = 15;
const BATCH_TX_TIMEOUT_MS = 300_000;

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

function buildLegacyRentSplitUpdate(table: string): string {
  return `UPDATE RealEstateBuildingSummary s
    JOIN (
      SELECT buildingName, bjdCode,
        MAX(CASE WHEN rentType = '전세' THEN deposit END)     AS jDeposit,
        MAX(CASE WHEN rentType = '전세' THEN dealKey END)     AS jDealKey,
        MAX(CASE WHEN rentType = '월세' THEN deposit END)     AS wDeposit,
        MAX(CASE WHEN rentType = '월세' THEN monthlyRent END) AS wMonthly,
        MAX(CASE WHEN rentType = '월세' THEN dealKey END)     AS wDealKey
      FROM (
        SELECT buildingName, bjdCode, rentType, deposit, monthlyRent,
          dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1) AS dealKey,
          ROW_NUMBER() OVER (
            PARTITION BY buildingName, bjdCode, rentType
            ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
          ) AS rn
        FROM ${table}
        WHERE city = ?
      ) ranked
      WHERE rn = 1
      GROUP BY buildingName, bjdCode
    ) t ON t.buildingName = s.buildingName AND t.bjdCode = s.bjdCode
    SET s.jeonseDeposit    = t.jDeposit,
        s.jeonseDealKey    = t.jDealKey,
        s.wolseDeposit     = t.wDeposit,
        s.wolseMonthlyRent = t.wMonthly,
        s.wolseDealKey     = t.wDealKey
    WHERE s.type = ? AND s.city = ?`;
}

async function refreshLegacySummaryType(type: string): Promise<SummaryBatchResult[]> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
  const buildYearCol = NO_BUILD_YEAR_TYPES.has(type) ? 'NULL' : 'buildYear';
  const monthlyRentCol = SALE_TYPES.has(type) ? 'NULL' : 'monthlyRent';
  const rows = await prisma.$queryRawUnsafe<Array<{ city: string | null }>>(
    `SELECT DISTINCT city
     FROM (
       SELECT DISTINCT city FROM ${table} WHERE city IS NOT NULL AND city != ''
       UNION
       SELECT DISTINCT city FROM RealEstateBuildingSummary WHERE type = ? AND city IS NOT NULL AND city != ''
     ) city_inventory
     ORDER BY city`,
    type,
  );
  const cities = rows.map((r) => r.city).filter((c): c is string => typeof c === 'string' && c.length > 0);
  const batches: SummaryBatchResult[] = [];

  for (const city of cities) {
    try {
      const inserted = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SEC}`);
          await tx.$executeRawUnsafe(`DELETE FROM RealEstateBuildingSummary WHERE type = ? AND city = ?`, type, city);
          const n = await tx.$executeRawUnsafe(
            `INSERT INTO RealEstateBuildingSummary
              (type, buildingName, bjdCode, city, district, dongName,
               latestPrice, monthlyRent,
               latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng,
               transactionCount, updatedAt)
             SELECT
              ? AS type,
              buildingName, bjdCode, city, district, TRIM(dongName) AS dongName,
              ${priceField} AS latestPrice,
              ${monthlyRentCol} AS monthlyRent,
              dealYear AS latestDealYear, dealMonth AS latestDealMonth, dealDay AS latestDealDay,
              ${buildYearCol} AS buildYear,
              _lat AS lat,
              _lng AS lng,
              _txCount AS transactionCount,
              NOW()
             FROM (
              SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY buildingName, bjdCode
                  ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
                ) AS _rn,
                COUNT(*) OVER (PARTITION BY buildingName, bjdCode) AS _txCount,
                FIRST_VALUE(lat) OVER (
                  PARTITION BY buildingName, bjdCode
                  ORDER BY (lat IS NULL OR lng IS NULL) ASC, dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
                ) AS _lat,
                FIRST_VALUE(lng) OVER (
                  PARTITION BY buildingName, bjdCode
                  ORDER BY (lat IS NULL OR lng IS NULL) ASC, dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
                ) AS _lng
              FROM ${table}
              WHERE city = ?
             ) ranked
             WHERE _rn = 1`,
            type,
            city,
          );
          if (!SALE_TYPES.has(type)) {
            await tx.$executeRawUnsafe(buildLegacyRentSplitUpdate(table), city, type, city);
          }
          return Number(n) || 0;
        },
        { timeout: batchTimeoutMs() },
      );
      batches.push({ type, city, rowCount: inserted, status: 'complete' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[LegacySummary] ${type}/${city} 실패:`, error);
      batches.push({ type, city, rowCount: 0, status: 'failed', error: message });
    }
    const pause = batchPauseMs();
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
  }

  return batches;
}

export async function refreshLegacySummariesUnlocked(types: string[] = Object.keys(TABLE_NAME_MAP)): Promise<SummaryRefreshResult> {
  const batches: SummaryBatchResult[] = [];
  for (const type of types) {
    try {
      batches.push(...await refreshLegacySummaryType(type));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[LegacySummary] ${type} city inventory failed:`, error);
      batches.push({ type, city: '*', rowCount: 0, status: 'failed', error: message });
    }
  }
  return { batches, complete: batches.every((batch) => batch.status === 'complete') };
}

export async function refreshLegacySummaries(types: string[] = Object.keys(TABLE_NAME_MAP)): Promise<SummaryRefreshResult> {
  return withRealEstateWriteLock('refreshLegacySummaries', () => refreshLegacySummariesUnlocked(types));
}
