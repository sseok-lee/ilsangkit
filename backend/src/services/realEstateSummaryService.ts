import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);

/**
 * 특정 타입의 Summary 테이블을 갱신 (DELETE + INSERT)
 */
export async function refreshSummary(type: string): Promise<number> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';

  // 트랜잭션으로 DELETE + INSERT 원자적 실행
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`DELETE FROM RealEstateBuildingSummary WHERE type = ?`, type);

    return tx.$queryRawUnsafe(
      `INSERT INTO RealEstateBuildingSummary
        (type, buildingName, bjdCode, city, district, dongName,
         latestPrice, latestDealYear, latestDealMonth, buildYear, lat, lng,
         transactionCount, updatedAt)
      SELECT
        ? as type,
        g.buildingName, g.bjdCode,
        d.city, d.district, d.dongName,
        d.${priceField} as latestPrice,
        g.lastDealYear, g.lastDealMonth,
        d.buildYear,
        g.lat, g.lng,
        g.transactionCount,
        NOW()
      FROM (
        SELECT buildingName, bjdCode,
          COUNT(*) as transactionCount,
          MAX(dealYear) as lastDealYear, MAX(dealMonth) as lastDealMonth,
          MAX(lat) as lat, MAX(lng) as lng
        FROM ${table}
        GROUP BY buildingName, bjdCode
      ) g
      LEFT JOIN ${table} d ON d.id = (
        SELECT id FROM ${table}
        WHERE buildingName = g.buildingName AND bjdCode = g.bjdCode
        ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
        LIMIT 1
      )`,
      type,
    );
  });

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
