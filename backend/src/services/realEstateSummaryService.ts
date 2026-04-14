import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
// buildYear 컬럼이 없는 타입
const NO_BUILD_YEAR_TYPES = new Set<string>();

/**
 * 특정 타입의 Summary 테이블을 갱신 (DELETE + INSERT)
 */
export async function refreshSummary(type: string): Promise<number> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
  const buildYearCol = NO_BUILD_YEAR_TYPES.has(type) ? 'NULL' : 'buildYear';

  // 트랜잭션으로 DELETE + INSERT 원자적 실행
  // 윈도우 함수로 단일 스캔 — 상관 서브쿼리(N+1) 제거
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`DELETE FROM RealEstateBuildingSummary WHERE type = ?`, type);

    return tx.$queryRawUnsafe(
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
  }, { timeout: 600000 });

  const inserted = Number(result) || 0;
  return inserted;
}

/**
 * 모든 타입의 Summary 갱신
 */
export async function refreshAllSummaries(): Promise<void> {
  const types = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
  for (const type of types) {
    const start = Date.now();
    const count = await refreshSummary(type);
    console.info(`[Summary] ${type}: ${count} buildings refreshed (${Date.now() - start}ms)`);
  }
}
