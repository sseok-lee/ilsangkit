import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { AREA_BANDS, refreshBuildingAreaSummariesUnlocked } from '../../src/services/realEstateAreaSummaryService.js';
import { getLatestDeals, latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import { fetchBuildings } from '../../src/services/realEstateMapService.js';
import { resolveMapFilter } from '../../src/schemas/realEstateMap.js';
import type { BuildingKey, LatestDeals, PropertyType } from '../../src/types/realEstateExploration.js';

const BJD = '99996';
const PREFIX = `area-summary-${Date.now().toString(36)}-`;
const properties: PropertyType[] = ['apt', 'villa', 'offitel'];
const types = properties.flatMap((p) => [`${p}-sale`, `${p}-rent`]);
const keyFor = (p: PropertyType): BuildingKey => ({ propertyType: p, buildingName: `${PREFIX}${p}`, bjdCode: BJD, dongName: '테스트동', jibun: '1' });
const hashFor = (p: PropertyType) => createHash('sha256').update(`${PREFIX}${p}`).digest('hex');
const models = {
  apt: [prisma.aptSaleTransaction, prisma.aptRentTransaction],
  villa: [prisma.villaSaleTransaction, prisma.villaRentTransaction],
  offitel: [prisma.offitelSaleTransaction, prisma.offitelRentTransaction],
};

async function cleanup() {
  for (const p of properties) {
    for (const model of models[p]) await model.deleteMany({ where: { sourceId: { startsWith: PREFIX } } });
  }
  await prisma.realEstatePublicUrl.deleteMany({ where: { buildingKey: { in: properties.map(hashFor) } } });
  await prisma.realEstateBuildingAreaSummary.deleteMany({ where: { bjdCode: BJD } });
  await prisma.realEstateBuildingSummaryV2.deleteMany({ where: { bjdCode: BJD } });
  await prisma.realEstateAreaSummaryState.deleteMany({ where: { scope: BJD } });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
  await cleanup();
  for (const p of properties) {
    const k = keyFor(p);
    const base = { buildingName: k.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: '테스트동', jibun: '1', dealYear: 2026, dealMonth: 10, dealDay: 1, lat: 37.5, lng: 127, buildYear: 2000 };
    for (const [i, area] of [60, 60.01, 85, 85.01, 135, 135.01, null].entries()) {
      await models[p][0].create({ data: { ...base, sourceId: `${PREFIX}${p}-sale-${i}`, exclusiveArea: area, floor: i, dealAmount: BigInt(10000 + i) } } as never);
      for (const rentType of ['전세', '월세']) {
        await models[p][1].create({ data: { ...base, sourceId: `${PREFIX}${p}-${rentType}-${i}`, exclusiveArea: area, floor: i, rentType, deposit: BigInt(10000 + i), monthlyRent: rentType === '월세' ? 101 : null } } as never);
      }
    }
    // 최신으로 보이지만 취소/미래/잘못된 날짜인 행은 계산에서도 제외되어야 한다.
    for (const [i, override] of [{ cancelDealType: '해제' }, { dealYear: 2027 }, { dealMonth: 2, dealDay: 30 }].entries()) {
      await models[p][0].create({ data: { ...base, exclusiveArea: 84, dealDay: 26, floor: 99, dealAmount: 999999n, sourceId: `${PREFIX}${p}-excluded-${i}`, ...override } } as never);
    }
    for (const type of [`${p}-sale`, `${p}-rent`]) {
      await prisma.realEstateBuildingSummaryV2.create({ data: { type, buildingKey: hashFor(p), buildingName: k.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: '테스트동', jibun: '1', lat: 37.5, lng: 127, transactionCount: 99 } });
      const path = `/real-estate/${type}/test/test/${hashFor(p)}`;
      const pathHash = createHash('sha256').update(path).digest('hex');
      await prisma.realEstatePublicUrl.create({ data: { type, buildingKey: hashFor(p), buildingName: k.buildingName, bjdCode: BJD,
        basePath: path, basePathHash: pathHash, canonicalPath: path, pathHash,
        addressSnapshot: {}, evidence: {}, sourceFingerprint: '0'.repeat(64) } });
    }
  }
}, 30000);

afterAll(async () => { try { await cleanup(); } finally { vi.useRealTimers(); await prisma.$disconnect(); } });

describe('면적 요약 MySQL 동등성', () => {
  it.each(types)('%s 다섯 구간이 getLatestDeals와 같다 (경계·동률 id·취소·미래·NULL 면적)', async (type) => {
    await refreshBuildingAreaSummariesUnlocked({ types: [type], bjdCode: BJD, batchSize: 1, pauseMs: 0 });
    const p = type.split('-')[0] as PropertyType;
    const k = keyFor(p);
    const scope = type.endsWith('sale') ? 'sale' : 'rent';
    const rows = await prisma.realEstateBuildingAreaSummary.findMany({ where: { type, bjdCode: BJD }, orderBy: { areaBand: 'asc' } });
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const expected = (await getLatestDeals([k], scope, { area: AREA_BANDS[row.areaBand] })).get(latestDealsKey(k))!;
      expect(row.latestDeals).toEqual(expected);
      expect(row.transactionCount).toBe(99);
      expect(row.saleAmount == null ? null : Number(row.saleAmount)).toBe(expected.sale?.amount ?? null);
      expect(row.jeonseDeposit).toBe(expected.jeonse?.deposit ?? null);
      expect(row.wolseMonthlyRent).toBe(expected.wolse?.monthlyRent ?? null);
      const deals = row.latestDeals as unknown as LatestDeals;
      expect((deals.sale ?? deals.jeonse)?.floor).toBe([6, 0, 2, 4, 5][row.areaBand]);
    }
  });

  it('실제 필터 SQL은 면적의 최근 거래로 매매·전세·월세 가격 경계를 판정한다', async () => {
    const bounds = { swLat: 37.499999, swLng: 126.999999, neLat: 37.500001, neLng: 127.000001 };
    for (const type of ['offitel-sale', 'offitel-rent']) {
      const previousState = await prisma.realEstateAreaSummaryState.findUnique({ where: { type_scope: { type, scope: '' } } });
      try {
        await refreshBuildingAreaSummariesUnlocked({ types: [type], pauseMs: 0 });
        const queries = type.endsWith('sale')
          ? [{ area: '60-85', price: '0-30000' }, { area: '60-85', price: '30000-60000' }]
          : [{ area: '60-85', price: '10000-30000', priceKind: 'jeonse' as const }, { area: '60-85', price: '0-10000', priceKind: 'jeonse' as const },
            { area: '60-85', price: '100-', priceKind: 'wolse' as const }, { area: '60-85', price: '50-100', priceKind: 'wolse' as const }];
        for (const [i, query] of queries.entries()) {
          const result = await fetchBuildings(type, bounds, resolveMapFilter(type, query));
          expect(result.total).toBe(i % 2 === 0 ? 1 : 0);
          expect(result.exact).toBe(true);
          expect(result).not.toHaveProperty('filter');
          if (result.items[0]) {
            expect(result.items[0].latestDeals[type.endsWith('sale') ? 'sale' : 'jeonse']?.exclusiveArea).toBe(85);
          }
        }
      } finally {
        await prisma.realEstateAreaSummaryState.deleteMany({ where: { type, scope: '' } });
        if (previousState) await prisma.realEstateAreaSummaryState.create({ data: previousState });
      }
    }
  });

  it('소스 요약에서 사라진 단지는 완료 후 정리되고 다른 지역은 유지된다', async () => {
    const type = 'apt-sale';
    await prisma.realEstateBuildingSummaryV2.deleteMany({ where: { type, bjdCode: BJD } });
    await refreshBuildingAreaSummariesUnlocked({ types: [type], bjdCode: BJD, pauseMs: 0 });
    expect(await prisma.realEstateBuildingAreaSummary.count({ where: { type, bjdCode: BJD } })).toBe(0);
    const [state] = await prisma.realEstateAreaSummaryState.findMany({ where: { type, scope: BJD } });
    expect(state.readyAt).not.toBeNull();
    expect(await prisma.realEstateBuildingAreaSummary.count({ where: { type: 'apt-rent', bjdCode: BJD } })).toBe(5);
  });
});
