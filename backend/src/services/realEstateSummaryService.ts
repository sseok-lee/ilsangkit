import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
// buildYear 컬럼이 없는 타입
const NO_BUILD_YEAR_TYPES = new Set<string>();

// 서버측 쿼리 킬 스위치 (ms). 클라이언트 $transaction timeout은 MySQL 서버에 KILL을 보내지 않아
// 좀비 쿼리를 유발했던 2026-04-17 사고의 재발 방지를 위한 MySQL 자체 타임아웃.
const STATEMENT_TIMEOUT_MS = 60_000;

/**
 * 특정 타입의 Summary 테이블을 갱신.
 *
 * 과거엔 DELETE+INSERT를 단일 $transaction으로 감쌌으나, Prisma의 transaction timeout은
 * 클라이언트측 대기 한도일 뿐 MySQL 쿼리 자체를 KILL하지 못해 INSERT가 7시간 넘어가는
 * 좀비 상황을 만들었다. 타입별 재생성이라 원자성이 필수는 아니므로 분리 실행하고,
 * 각 쿼리 앞에 `MAX_EXECUTION_TIME`을 걸어 MySQL이 스스로 타임아웃하도록 한다.
 */
export async function refreshSummary(type: string): Promise<number> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
  const buildYearCol = NO_BUILD_YEAR_TYPES.has(type) ? 'NULL' : 'buildYear';

  await prisma.$executeRawUnsafe(`SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_TIMEOUT_MS}`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM RealEstateBuildingSummary WHERE type = ?`,
    type,
  );

  await prisma.$executeRawUnsafe(`SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_TIMEOUT_MS}`);
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO RealEstateBuildingSummary
      (type, buildingName, bjdCode, city, district, dongName,
       latestPrice, latestDealYear, latestDealMonth, buildYear, lat, lng,
       transactionCount, updatedAt)
    SELECT
      ? AS type,
      buildingName, bjdCode, city, district, dongName,
      ${priceField} AS latestPrice,
      dealYear AS latestDealYear, dealMonth AS latestDealMonth,
      ${buildYearCol} AS buildYear,
      MAX(lat) OVER (PARTITION BY buildingName, bjdCode) AS lat,
      MAX(lng) OVER (PARTITION BY buildingName, bjdCode) AS lng,
      COUNT(*) OVER (PARTITION BY buildingName, bjdCode) AS transactionCount,
      NOW()
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY buildingName, bjdCode
          ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
        ) AS _rn
      FROM ${table}
    ) ranked
    WHERE _rn = 1`,
    type,
  );

  return Number(inserted) || 0;
}

/**
 * 모든 타입의 Summary 갱신. 한 타입이 실패해도 다음 타입으로 계속 진행해
 * 전체가 중단되지 않도록 한다.
 */
export async function refreshAllSummaries(): Promise<void> {
  const types = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
  for (const type of types) {
    const start = Date.now();
    try {
      const count = await refreshSummary(type);
      console.info(`[Summary] ${type}: ${count} buildings refreshed (${Date.now() - start}ms)`);
    } catch (err) {
      console.error(`[Summary] ${type} 실패 (${Date.now() - start}ms):`, err);
    }
  }
}
