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
  fetchBuildings, BUILDING_LIMIT,
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

describe('fetchBuildings 필터 경로', () => {
  it('요약만 COUNT/목록 조회하고 거래 테이블은 읽지 않는다', async () => {
    const latestDeals = { sale: deal('sale', { amount: 80000 }), jeonse: null, wolse: null };
    queryRawUnsafe.mockResolvedValueOnce([{ readyAt: new Date() }])
      .mockResolvedValueOnce([{ cnt: 854n }])
      .mockResolvedValueOnce([{ ...row(1), latestDeals }]);
    const r = await fetchBuildings('apt-sale', BOUNDS, resolveMapFilter('apt-sale', { area: '60-85', price: '60000-90000' }));
    expect(mockGetLatestDeals).not.toHaveBeenCalled();
    const calls = queryRawUnsafe.mock.calls;
    expect(calls).toHaveLength(3);
    for (const call of calls.slice(1)) {
      expect(call[0]).toContain('RealEstateBuildingAreaSummary');
      expect(call[0]).not.toMatch(/Transaction|ROW_NUMBER/);
      expect(call[0]).toContain('areaBand = ?');
      expect(call[0]).toContain('saleAmount > ?');
      expect(call[0]).toContain('saleAmount <= ?');
      expect(call.slice(1)).toEqual(['apt-sale', 2, 37.46, 37.54, 127, 127.1, 60000, 90000]);
    }
    expect(calls[2][0]).toContain(`LIMIT ${BUILDING_LIMIT}`);
    expect(calls[2][0]).toContain('ORDER BY transactionCount DESC');
    expect(r).toMatchObject({ total: 854, exact: false });
    expect(r).not.toHaveProperty('filter');
    expect(r.items[0].latestDeals).toEqual(latestDeals);
  });

  it.each([
    ['villa-rent', { price: '0-10000', priceKind: 'jeonse' as const }, 'jeonseDeposit <= ?', 10000],
    ['apt-rent', { price: '100-', priceKind: 'wolse' as const }, 'wolseMonthlyRent > ?', 100],
  ])('가격만이면 전체 구간 0과 종류별 가격 컬럼: %s', async (type, q, column, amount) => {
    queryRawUnsafe.mockResolvedValueOnce([{ readyAt: new Date() }]).mockResolvedValueOnce([{ cnt: 0 }]).mockResolvedValueOnce([]);
    const r = await fetchBuildings(type, BOUNDS, resolveMapFilter(type, q));
    expect(queryRawUnsafe.mock.calls[1][0]).toContain(column);
    expect(queryRawUnsafe.mock.calls[1].slice(1)).toEqual([type, 0, 37.46, 37.54, 127, 127.1, amount]);
    expect(r).toEqual({ items: [], total: 0, exact: true });
    expect(mockGetLatestDeals).not.toHaveBeenCalled();
  });

  it('백필 전에는 503 준비 중이며 거래 조회로 폴백하지 않는다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([]);
    await expect(fetchBuildings('apt-sale', BOUNDS, resolveMapFilter('apt-sale', { area: '135-' })))
      .rejects.toMatchObject({ statusCode: 503, code: 'MAP_FILTERS_PREPARING' });
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockGetLatestDeals).not.toHaveBeenCalled();
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
