import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAptSaleCount,
  mockAptRentCount,
  mockVillaSaleCount,
  mockVillaRentCount,
  mockOffitelSaleCount,
  mockOffitelRentCount,
  mockQueryRaw,
  mockSubscriptionCount,
  mockSubscriptionUnitTypeAggregate,
  mockSubscriptionFindMany,
  mockGenericCount,
} = vi.hoisted(() => ({
  mockAptSaleCount: vi.fn(),
  mockAptRentCount: vi.fn(),
  mockVillaSaleCount: vi.fn(),
  mockVillaRentCount: vi.fn(),
  mockOffitelSaleCount: vi.fn(),
  mockOffitelRentCount: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockSubscriptionCount: vi.fn(),
  mockSubscriptionUnitTypeAggregate: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  mockGenericCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    toilet: { count: mockGenericCount },
    wifi: { count: mockGenericCount },
    clothes: { count: mockGenericCount },
    wasteSchedule: { count: mockGenericCount },
    parking: { count: mockGenericCount },
    aed: { count: mockGenericCount },
    library: { count: mockGenericCount },
    hospital: { count: mockGenericCount },
    pharmacy: { count: mockGenericCount },
    park: { count: mockGenericCount },
    school: { count: mockGenericCount },
    market: { count: mockGenericCount },
    childcare: { count: mockGenericCount },
    sports: { count: mockGenericCount },
    region: { count: mockGenericCount },
    aptSaleTransaction: { count: mockAptSaleCount },
    aptRentTransaction: { count: mockAptRentCount },
    villaSaleTransaction: { count: mockVillaSaleCount },
    villaRentTransaction: { count: mockVillaRentCount },
    offitelSaleTransaction: { count: mockOffitelSaleCount },
    offitelRentTransaction: { count: mockOffitelRentCount },
    subscription: { count: mockSubscriptionCount, findMany: mockSubscriptionFindMany },
    subscriptionUnitType: { aggregate: mockSubscriptionUnitTypeAggregate },
    $queryRaw: mockQueryRaw,
  },
  prisma: {
    toilet: { count: mockGenericCount },
    wifi: { count: mockGenericCount },
    clothes: { count: mockGenericCount },
    wasteSchedule: { count: mockGenericCount },
    parking: { count: mockGenericCount },
    aed: { count: mockGenericCount },
    library: { count: mockGenericCount },
    hospital: { count: mockGenericCount },
    pharmacy: { count: mockGenericCount },
    park: { count: mockGenericCount },
    school: { count: mockGenericCount },
    market: { count: mockGenericCount },
    childcare: { count: mockGenericCount },
    sports: { count: mockGenericCount },
    region: { count: mockGenericCount },
    aptSaleTransaction: { count: mockAptSaleCount },
    aptRentTransaction: { count: mockAptRentCount },
    villaSaleTransaction: { count: mockVillaSaleCount },
    villaRentTransaction: { count: mockVillaRentCount },
    offitelSaleTransaction: { count: mockOffitelSaleCount },
    offitelRentTransaction: { count: mockOffitelRentCount },
    subscription: { count: mockSubscriptionCount, findMany: mockSubscriptionFindMany },
    subscriptionUnitType: { aggregate: mockSubscriptionUnitTypeAggregate },
    $queryRaw: mockQueryRaw,
  },
}));

// subscriptionService mock (imported by metaService)
vi.mock('../../src/services/subscriptionService.js', () => ({
  dateBasedStatusFilter: vi.fn((status: string) => ({ status })),
}));

import {
  getNewlyListedToday,
  getRealEstateTrends,
  getTrendingBuildings,
  getSubscriptionSummary,
  getHomeDashboard,
  clearHomeDashboardCache,
} from '../../src/services/metaService.js';

// ─────────────────────────────────────────────
// Task 2: getNewlyListedToday
// ─────────────────────────────────────────────
describe('getNewlyListedToday', () => {
  beforeEach(() => {
    mockAptSaleCount.mockReset();
    mockAptRentCount.mockReset();
    mockVillaSaleCount.mockReset();
    mockVillaRentCount.mockReset();
    mockOffitelSaleCount.mockReset();
    mockOffitelRentCount.mockReset();
  });

  it('returns sum of 6 transaction tables filtered by createdAt >= today 00:00 KST', async () => {
    mockAptSaleCount.mockResolvedValue(100);
    mockAptRentCount.mockResolvedValue(50);
    mockVillaSaleCount.mockResolvedValue(20);
    mockVillaRentCount.mockResolvedValue(10);
    mockOffitelSaleCount.mockResolvedValue(5);
    mockOffitelRentCount.mockResolvedValue(3);

    const result = await getNewlyListedToday();

    expect(result).toBe(188);
    const calls = [
      mockAptSaleCount,
      mockAptRentCount,
      mockVillaSaleCount,
      mockVillaRentCount,
      mockOffitelSaleCount,
      mockOffitelRentCount,
    ];
    const firstGte = calls[0].mock.calls[0][0].where.createdAt.gte;
    expect(firstGte).toBeInstanceOf(Date);
    for (const c of calls) {
      expect(c.mock.calls[0][0].where.createdAt.gte).toEqual(firstGte);
    }
  });
});

// ─────────────────────────────────────────────
// Task 3: getRealEstateTrends
// ─────────────────────────────────────────────
describe('getRealEstateTrends', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns 3 slots: apt-sale, apt-rent-jeonse, offitel-sale with avg / count / changePct', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ avg: 54000, cnt: BigInt(2481) }])  // aptCurr
      .mockResolvedValueOnce([{ avg: 52800, cnt: BigInt(2300) }])  // aptPrev
      .mockResolvedValueOnce([{ avg: 31000, cnt: BigInt(1742) }])  // jeonseCurr
      .mockResolvedValueOnce([{ avg: 31250, cnt: BigInt(1800) }])  // jeonsePrev
      .mockResolvedValueOnce([{ avg: 22000, cnt: BigInt(318) }])   // offCurr
      .mockResolvedValueOnce([{ avg: null,  cnt: BigInt(0) }]);    // offPrev

    const trends = await getRealEstateTrends();

    expect(trends).toHaveLength(3);
    const [aptSale, jeonse, offitelSale] = trends;

    expect(aptSale).toMatchObject({ key: 'apt-sale', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800 });
    expect(aptSale.changePct).toBeCloseTo(((54000 - 52800) / 52800) * 100, 3);

    expect(jeonse).toMatchObject({ key: 'apt-rent-jeonse', avgPrice: 31000 });
    expect(jeonse.changePct).toBeLessThan(0);

    expect(offitelSale).toMatchObject({ key: 'offitel-sale', avgPrice: 22000, prevAvgPrice: null, changePct: null });
  });

  it('returns null avgPrice and changePct when current period has 0 rows', async () => {
    mockQueryRaw.mockResolvedValue([{ avg: null, cnt: BigInt(0) }]);

    const trends = await getRealEstateTrends();
    for (const t of trends) {
      expect(t.avgPrice).toBeNull();
      expect(t.changePct).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────
// Task 4: getTrendingBuildings
// ─────────────────────────────────────────────
describe('getTrendingBuildings', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns 3 lists (sale/jeonse/wolse) sorted by txnCount desc, capped at 5', async () => {
    mockQueryRaw
      // sale
      .mockResolvedValueOnce([
        { buildingName: '헬리오시티', city: '서울특별시', district: '송파구', txnCount: BigInt(17), avgPrice: 184000, avgMonthlyRent: null },
        { buildingName: '은마아파트',  city: '서울특별시', district: '강남구', txnCount: BigInt(14), avgPrice: 267000, avgMonthlyRent: null },
      ])
      // jeonse
      .mockResolvedValueOnce([
        { buildingName: '파크리오', city: '서울특별시', district: '송파구', txnCount: BigInt(22), avgPrice: 84000, avgMonthlyRent: null },
      ])
      // wolse
      .mockResolvedValueOnce([
        { buildingName: '아크로리버파크', city: '서울특별시', district: '서초구', txnCount: BigInt(9), avgPrice: 20000, avgMonthlyRent: 120 },
      ]);

    const result = await getTrendingBuildings();

    expect(result.sale[0]).toMatchObject({ buildingName: '헬리오시티', txnCount: 17, avgPrice: 184000, avgMonthlyRent: null });
    expect(result.sale[0].slug).toBe(encodeURIComponent('헬리오시티'));
    expect(result.jeonse[0]).toMatchObject({ buildingName: '파크리오', txnCount: 22, avgPrice: 84000, avgMonthlyRent: null });
    expect(result.jeonse[0].slug).toBe(encodeURIComponent('파크리오'));
    expect(result.wolse[0]).toMatchObject({ buildingName: '아크로리버파크', avgPrice: 20000, avgMonthlyRent: 120 });
    expect(result.wolse[0].slug).toBe(encodeURIComponent('아크로리버파크'));
  });

  it('returns empty arrays when no data', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await getTrendingBuildings();
    expect(result.sale).toEqual([]);
    expect(result.jeonse).toEqual([]);
    expect(result.wolse).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Task 5: getSubscriptionSummary
// ─────────────────────────────────────────────
describe('getSubscriptionSummary', () => {
  beforeEach(() => {
    mockSubscriptionCount.mockReset();
    mockSubscriptionUnitTypeAggregate.mockReset();
    mockSubscriptionFindMany.mockReset();
  });

  it('returns closingThisWeek + upcomingNextWeek counts and imminent list (D-3)', async () => {
    mockSubscriptionCount.mockResolvedValueOnce(8);  // closingThisWeek
    mockSubscriptionCount.mockResolvedValueOnce(12); // upcomingNextWeek
    mockSubscriptionUnitTypeAggregate.mockResolvedValue({ _avg: { topAmount: 68000 } });
    mockSubscriptionFindMany.mockResolvedValue([
      { id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', receptionEndDate: new Date('2026-05-21') },
      { id: 2, houseName: '힐스테이트 광교',   regionName: '경기 수원시',  receptionEndDate: new Date('2026-05-22') },
    ]);

    const result = await getSubscriptionSummary();

    expect(result.closingThisWeek).toBe(8);
    expect(result.upcomingNextWeek).toBe(12);
    expect(result.avgSupplyPrice).toBe(68000);
    expect(result.imminent).toHaveLength(2);
    expect(result.imminent[0]).toMatchObject({
      id: 1,
      houseName: '래미안 강동 팰리스',
      regionName: '서울 강동구',
      endDate: '2026-05-21',
    });
  });

  it('avgSupplyPrice null when aggregate returns null', async () => {
    mockSubscriptionCount.mockResolvedValue(0);
    mockSubscriptionUnitTypeAggregate.mockResolvedValue({ _avg: { topAmount: null } });
    mockSubscriptionFindMany.mockResolvedValue([]);

    const result = await getSubscriptionSummary();
    expect(result.avgSupplyPrice).toBeNull();
    expect(result.imminent).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Task 6: getHomeDashboard (composite + cache)
// ─────────────────────────────────────────────

// Helper: set up all mocks for a full getHomeDashboard call
// getHomeDashboard calls: getStats, getNewlyListedToday, getRealEstateTrends, getTrendingBuildings, getSubscriptionSummary
// getStats uses:
//   - prisma.toilet/wifi/.../sports/region.count() → mockGenericCount (already always resolves 0)
//   - prisma.aptSaleTransaction/aptRentTransaction/... count → specific mocks
//   - prisma.subscription.count() → mockSubscriptionCount (once, for subscriptionActiveCount)
//   - prisma.$queryRaw x2 (evCharger cnt, buildingCountResult)
// getNewlyListedToday uses count mocks (already set by getStats, uses .mockResolvedValue so shared)
// getRealEstateTrends uses $queryRaw x6
// getTrendingBuildings uses $queryRaw x3
// getSubscriptionSummary uses:
//   - prisma.subscription.count() x2 (closingThisWeek, upcomingNextWeek)
//   - prisma.subscriptionUnitType.aggregate x1
//   - prisma.subscription.findMany x1
function setupFullMocks() {
  mockAptSaleCount.mockResolvedValue(1000);
  mockAptRentCount.mockResolvedValue(800);
  mockVillaSaleCount.mockResolvedValue(200);
  mockVillaRentCount.mockResolvedValue(100);
  mockOffitelSaleCount.mockResolvedValue(50);
  mockOffitelRentCount.mockResolvedValue(30);
  // subscription.count called 3 times total: 1 (getStats) + 2 (getSubscriptionSummary)
  mockSubscriptionCount.mockResolvedValue(5);

  // $queryRaw sequence: 2 (stats) + 6 (trends) + 3 (buildings) = 11 total
  mockQueryRaw
    .mockResolvedValueOnce([{ cnt: BigInt(500) }])                                            // stats: evCharger
    .mockResolvedValueOnce([{ apt: BigInt(20000), villa: BigInt(8000), offitel: BigInt(2000) }]) // stats: buildingCount
    .mockResolvedValueOnce([{ avg: 54000, cnt: BigInt(100) }])  // trends: aptCurr
    .mockResolvedValueOnce([{ avg: 52000, cnt: BigInt(90) }])   // trends: aptPrev
    .mockResolvedValueOnce([{ avg: 30000, cnt: BigInt(80) }])   // trends: jeonseCurr
    .mockResolvedValueOnce([{ avg: 31000, cnt: BigInt(85) }])   // trends: jeonsePrev
    .mockResolvedValueOnce([{ avg: 22000, cnt: BigInt(30) }])   // trends: offCurr
    .mockResolvedValueOnce([{ avg: null,  cnt: BigInt(0) }])    // trends: offPrev
    .mockResolvedValueOnce([])                                  // buildings: sale
    .mockResolvedValueOnce([])                                  // buildings: jeonse
    .mockResolvedValueOnce([]);                                 // buildings: wolse

  mockSubscriptionUnitTypeAggregate.mockResolvedValue({ _avg: { topAmount: null } });
  mockSubscriptionFindMany.mockResolvedValue([]);
}

describe('getHomeDashboard', () => {
  beforeEach(() => {
    clearHomeDashboardCache();
    mockAptSaleCount.mockReset();
    mockAptRentCount.mockReset();
    mockVillaSaleCount.mockReset();
    mockVillaRentCount.mockReset();
    mockOffitelSaleCount.mockReset();
    mockOffitelRentCount.mockReset();
    mockQueryRaw.mockReset();
    mockSubscriptionCount.mockReset();
    mockSubscriptionUnitTypeAggregate.mockReset();
    mockSubscriptionFindMany.mockReset();
    mockGenericCount.mockReset();
    mockGenericCount.mockResolvedValue(0);
  });

  it('returns composite payload from all helpers', async () => {
    setupFullMocks();

    const result = await getHomeDashboard();
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('newlyListedToday');
    expect(result.realEstateTrends).toHaveLength(3);
    expect(result.trendingBuildings).toHaveProperty('sale');
    expect(result.trendingBuildings).toHaveProperty('jeonse');
    expect(result.trendingBuildings).toHaveProperty('wolse');
    expect(result.subscriptionSummary).toHaveProperty('closingThisWeek');
  });

  it('caches result for 1 hour', async () => {
    setupFullMocks();
    await getHomeDashboard();
    const firstCallCount = mockQueryRaw.mock.calls.length;
    // second call — cache hit, no new DB queries
    await getHomeDashboard();
    expect(mockQueryRaw.mock.calls.length).toBe(firstCallCount);
  });

  it('clearHomeDashboardCache forces re-fetch', async () => {
    setupFullMocks();
    await getHomeDashboard();
    const before = mockQueryRaw.mock.calls.length;
    clearHomeDashboardCache();
    setupFullMocks();
    await getHomeDashboard();
    expect(mockQueryRaw.mock.calls.length).toBeGreaterThan(before);
  });
});
