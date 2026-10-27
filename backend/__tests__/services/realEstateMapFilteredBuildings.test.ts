import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryRawUnsafe, mockGetLatestDeals, mockAttachCanonicalPaths } = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  mockGetLatestDeals: vi.fn(),
  mockAttachCanonicalPaths: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));
vi.mock('../../src/services/realEstateLatestDeals.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/realEstateLatestDeals.js');
  return { ...actual, getLatestDeals: mockGetLatestDeals };
});
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: mockAttachCanonicalPaths,
}));

import {
  fetchBuildings, matchesMapFilter, BUILDING_LIMIT, FILTER_CANDIDATE_LIMIT,
} from '../../src/services/realEstateMapService.js';
import { latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import { resolveMapFilter } from '../../src/schemas/realEstateMap.js';
import type { BuildingKey, DealSnapshot, LatestDeals } from '../../src/types/realEstateExploration.js';

const BOUNDS = { swLat: 37.46, swLng: 127.0, neLat: 37.54, neLng: 127.1 };

function deal(kind: DealSnapshot['kind'], v: Partial<DealSnapshot>): DealSnapshot {
  return {
    kind, amount: null, deposit: null, monthlyRent: null, exclusiveArea: 84, floor: 3,
    dealYear: 2026, dealMonth: 9, dealDay: 1, ...v,
  };
}

function row(i: number): Record<string, unknown> {
  return {
    buildingKey: `k${i}`, jibun: `${i}`, buildingName: `단지${i}`, bjdCode: '11680', city: '서울',
    district: '강남구', dongName: '대치동', lat: 37.5, lng: 127.05, latestPrice: 100000n,
    monthlyRent: null, transactionCount: 1000 - i,
  };
}

/** 단지 이름 → latestDeals. 없는 단지는 빈 묶음. */
function stubDeals(byName: Record<string, Partial<LatestDeals>>): void {
  mockGetLatestDeals.mockImplementation((keys: BuildingKey[]) => {
    const m = new Map<string, LatestDeals>();
    for (const k of keys) m.set(latestDealsKey(k), { sale: null, jeonse: null, wolse: null, ...byName[k.buildingName] });
    return Promise.resolve(m);
  });
}

beforeEach(() => {
  queryRawUnsafe.mockReset();
  mockGetLatestDeals.mockReset();
  mockAttachCanonicalPaths.mockReset();
  mockAttachCanonicalPaths.mockImplementation((rows: unknown[]) => Promise.resolve(rows));
});

describe('matchesMapFilter', () => {
  const sale = { sale: deal('sale', { amount: 150000 }), jeonse: null, wolse: null };
  const rent = {
    sale: null,
    jeonse: deal('jeonse', { deposit: 50000 }),
    wolse: deal('wolse', { deposit: 5000, monthlyRent: 100 }),
  };

  it('매매 가격은 거래금액, 경계는 상한 이하', () => {
    expect(matchesMapFilter(sale, 'apt-sale', resolveMapFilter('apt-sale', { price: '90000-150000' })!)).toBe(true);
    expect(matchesMapFilter(sale, 'apt-sale', resolveMapFilter('apt-sale', { price: '150000-250000' })!)).toBe(false);
  });

  it('전세는 보증금, 월세는 월세액으로 판정한다', () => {
    expect(matchesMapFilter(rent, 'apt-rent', resolveMapFilter('apt-rent', { price: '30000-50000', priceKind: 'jeonse' })!)).toBe(true);
    expect(matchesMapFilter(rent, 'apt-rent', resolveMapFilter('apt-rent', { price: '50000-80000', priceKind: 'jeonse' })!)).toBe(false);
    expect(matchesMapFilter(rent, 'apt-rent', resolveMapFilter('apt-rent', { price: '50-100', priceKind: 'wolse' })!)).toBe(true);
    expect(matchesMapFilter(rent, 'apt-rent', resolveMapFilter('apt-rent', { price: '100-', priceKind: 'wolse' })!)).toBe(false);
  });

  it('고른 종류의 거래가 없으면 제외', () => {
    const onlyWolse = { ...rent, jeonse: null };
    expect(matchesMapFilter(onlyWolse, 'apt-rent', resolveMapFilter('apt-rent', { price: '0-10000', priceKind: 'jeonse' })!)).toBe(false);
  });

  it('면적만이면 그 면적 거래가 있는 단지(전월세는 전세·월세 중 하나라도)', () => {
    const area = resolveMapFilter('apt-rent', { area: '60-85' })!;
    expect(matchesMapFilter({ sale: null, jeonse: null, wolse: rent.wolse }, 'apt-rent', area)).toBe(true);
    expect(matchesMapFilter({ sale: null, jeonse: null, wolse: null }, 'apt-rent', area)).toBe(false);
    expect(matchesMapFilter({ sale: null, jeonse: null, wolse: null }, 'apt-sale', resolveMapFilter('apt-sale', { area: '60-85' })!)).toBe(false);
  });
});

describe('fetchBuildings 필터 경로', () => {
  it('후보를 상한+1 개 뽑고, 면적 범위를 최근 거래 조회에 넘긴다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([row(1), row(2), row(3)]);
    stubDeals({ 단지1: { sale: deal('sale', { amount: 80000 }) }, 단지3: { sale: deal('sale', { amount: 70000 }) } });

    const r = await fetchBuildings('apt-sale', BOUNDS, resolveMapFilter('apt-sale', { area: '60-85', price: '60000-90000' }));

    // COUNT 쿼리 없이 목록 한 번
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY transactionCount DESC');
    expect(sql).toContain(`LIMIT ${FILTER_CANDIDATE_LIMIT + 1}`);
    expect(sql).toContain('FORCE INDEX');
    expect(mockGetLatestDeals.mock.calls[0][1]).toBe('sale');
    expect(mockGetLatestDeals.mock.calls[0][2]).toEqual({ area: { min: 60, max: 85 } });
    // 거래 많은 순 유지, 조건 안 맞는 단지2 제외
    expect(r.items.map((i) => i.buildingName)).toEqual(['단지1', '단지3']);
    expect(r.items[0].latestDeals.sale?.amount).toBe(80000);
    expect(r).toMatchObject({ total: 2, exact: true, filter: { scanned: 3, approximate: false } });
  });

  it('가격만이면 면적 옵션 없이 조회한다(핀과 같은 최근 거래로 판정)', async () => {
    queryRawUnsafe.mockResolvedValueOnce([row(1)]);
    stubDeals({ 단지1: { jeonse: deal('jeonse', { deposit: 9000 }) } });
    const r = await fetchBuildings('villa-rent', BOUNDS, resolveMapFilter('villa-rent', { price: '0-10000', priceKind: 'jeonse' }));
    expect(mockGetLatestDeals.mock.calls[0]).toHaveLength(2);
    expect(mockGetLatestDeals.mock.calls[0][1]).toBe('rent');
    expect(r.total).toBe(1);
  });

  it('후보가 상한을 넘으면 상한까지만 조회하고 approximate', async () => {
    queryRawUnsafe.mockResolvedValueOnce(Array.from({ length: FILTER_CANDIDATE_LIMIT + 1 }, (_, i) => row(i)));
    stubDeals({});
    const r = await fetchBuildings('apt-sale', BOUNDS, resolveMapFilter('apt-sale', { area: '135-' }));
    expect(mockGetLatestDeals.mock.calls[0][0]).toHaveLength(FILTER_CANDIDATE_LIMIT);
    expect(r).toMatchObject({ items: [], total: 0, exact: false, filter: { scanned: FILTER_CANDIDATE_LIMIT, approximate: true } });
  });

  it('맞는 단지가 많아도 BUILDING_LIMIT 개까지만 내고, canonicalPath 는 낸 단지에만 붙인다', async () => {
    queryRawUnsafe.mockResolvedValueOnce(Array.from({ length: 300 }, (_, i) => row(i)));
    mockGetLatestDeals.mockImplementation((keys: BuildingKey[]) => Promise.resolve(new Map(keys.map((k) => [
      latestDealsKey(k), { sale: deal('sale', { amount: 10000 }), jeonse: null, wolse: null },
    ]))));
    const r = await fetchBuildings('apt-sale', BOUNDS, resolveMapFilter('apt-sale', { price: '0-30000' }));
    expect(r.items).toHaveLength(BUILDING_LIMIT);
    expect(r.total).toBe(300);
    expect(r.exact).toBe(false);
    expect(r.filter?.approximate).toBe(false);
    expect(mockAttachCanonicalPaths.mock.calls[0][0]).toHaveLength(BUILDING_LIMIT);
  });

  it('필터가 없으면 기존 경로 — COUNT 후 목록, 최근 거래는 옵션 없이, 응답에 filter 없음', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([row(1)]);
    stubDeals({});
    const r = await fetchBuildings('apt-sale', BOUNDS, null);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(queryRawUnsafe.mock.calls[1][0]).toContain(`LIMIT ${BUILDING_LIMIT}`);
    expect(mockGetLatestDeals.mock.calls[0]).toHaveLength(2);
    expect(r).not.toHaveProperty('filter');
    expect(Object.keys(r).sort()).toEqual(['exact', 'items', 'total']);
  });
});
