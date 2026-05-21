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
  mockGetPropertyHotspots,
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
  mockGetPropertyHotspots: vi.fn(),
}));

vi.mock('../../src/services/realEstateHotspotService.js', () => ({
  getPropertyHotspots: mockGetPropertyHotspots,
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

  // 평당가 = (sumPrice/sumArea) × 3.3058. 테스트 값은 sumArea=1로 두어 sumPrice 자체가 곧 (만원/㎡)이 되도록 단순화.
  const M2_PER_PYEONG = 3.3058;
  const expectedPpp = (sumPrice: number, sumArea: number) => (sumPrice / sumArea) * M2_PER_PYEONG;

  it('returns 9 slots: apt/villa/offitel × sale/jeonse/wolse with pricePerPyeong / count / changePct', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ sumPrice: 54000, sumArea: 1, cnt: BigInt(2481) }])  // aptCurr
      .mockResolvedValueOnce([{ sumPrice: 52800, sumArea: 1, cnt: BigInt(2300) }])  // aptPrev
      .mockResolvedValueOnce([{ sumPrice: 31000, sumArea: 1, cnt: BigInt(1742) }])  // aptJeonseCurr
      .mockResolvedValueOnce([{ sumPrice: 31250, sumArea: 1, cnt: BigInt(1800) }])  // aptJeonsePrev
      .mockResolvedValueOnce([{ sumPrice: 85,    sumArea: 1, cnt: BigInt(920) }])   // aptWolseCurr
      .mockResolvedValueOnce([{ sumPrice: 80,    sumArea: 1, cnt: BigInt(870) }])   // aptWolsePrev
      .mockResolvedValueOnce([{ sumPrice: 18000, sumArea: 1, cnt: BigInt(540) }])   // villaCurr
      .mockResolvedValueOnce([{ sumPrice: 17500, sumArea: 1, cnt: BigInt(500) }])   // villaPrev
      .mockResolvedValueOnce([{ sumPrice: 12000, sumArea: 1, cnt: BigInt(320) }])   // villaJeonseCurr
      .mockResolvedValueOnce([{ sumPrice: 11800, sumArea: 1, cnt: BigInt(300) }])   // villaJeonsePrev
      .mockResolvedValueOnce([{ sumPrice: 55,    sumArea: 1, cnt: BigInt(180) }])   // villaWolseCurr
      .mockResolvedValueOnce([{ sumPrice: 52,    sumArea: 1, cnt: BigInt(160) }])   // villaWolsePrev
      .mockResolvedValueOnce([{ sumPrice: 22000, sumArea: 1, cnt: BigInt(318) }])   // offCurr
      .mockResolvedValueOnce([{ sumPrice: null,  sumArea: null, cnt: BigInt(0) }])  // offPrev
      .mockResolvedValueOnce([{ sumPrice: 15000, sumArea: 1, cnt: BigInt(210) }])   // offJeonseCurr
      .mockResolvedValueOnce([{ sumPrice: 14800, sumArea: 1, cnt: BigInt(200) }])   // offJeonsePrev
      .mockResolvedValueOnce([{ sumPrice: 72,    sumArea: 1, cnt: BigInt(95) }])    // offWolseCurr
      .mockResolvedValueOnce([{ sumPrice: 68,    sumArea: 1, cnt: BigInt(88) }]);   // offWolsePrev

    const trends = await getRealEstateTrends();

    expect(trends).toHaveLength(9);
    const [aptSale, aptJeonse, aptWolse, villaSale, villaJeonse, villaWolse, offitelSale, offitelJeonse, offitelWolse] = trends;

    expect(aptSale).toMatchObject({ key: 'apt-sale', txnCount: 2481 });
    expect(aptSale.pricePerPyeong).toBeCloseTo(expectedPpp(54000, 1), 3);
    expect(aptSale.prevPricePerPyeong).toBeCloseTo(expectedPpp(52800, 1), 3);
    expect(aptSale.changePct).toBeCloseTo(((54000 - 52800) / 52800) * 100, 3);

    expect(aptJeonse).toMatchObject({ key: 'apt-rent-jeonse' });
    expect(aptJeonse.pricePerPyeong).toBeCloseTo(expectedPpp(31000, 1), 3);
    expect(aptJeonse.changePct).toBeLessThan(0);

    expect(aptWolse).toMatchObject({ key: 'apt-rent-wolse', label: '아파트 월세', txnCount: 920 });
    expect(aptWolse.pricePerPyeong).toBeCloseTo(expectedPpp(85, 1), 3);
    expect(aptWolse.changePct).toBeCloseTo(((85 - 80) / 80) * 100, 3);

    expect(villaSale).toMatchObject({ key: 'villa-sale', label: '빌라 매매', txnCount: 540 });
    expect(villaSale.changePct).toBeGreaterThan(0);

    expect(villaJeonse).toMatchObject({ key: 'villa-rent-jeonse', label: '빌라 전세', txnCount: 320 });
    expect(villaJeonse.changePct).toBeGreaterThan(0);

    expect(villaWolse).toMatchObject({ key: 'villa-rent-wolse', label: '빌라 월세', txnCount: 180 });
    expect(villaWolse.changePct).toBeGreaterThan(0);

    expect(offitelSale).toMatchObject({ key: 'offitel-sale', prevPricePerPyeong: null, changePct: null });
    expect(offitelSale.pricePerPyeong).toBeCloseTo(expectedPpp(22000, 1), 3);

    expect(offitelJeonse).toMatchObject({ key: 'offitel-rent-jeonse', label: '오피스텔 전세', txnCount: 210 });
    expect(offitelJeonse.changePct).toBeGreaterThan(0);

    expect(offitelWolse).toMatchObject({ key: 'offitel-rent-wolse', label: '오피스텔 월세', txnCount: 95 });
    expect(offitelWolse.changePct).toBeGreaterThan(0);
  });

  it('computes pricePerPyeong with face-weighted average (SUM/SUM × 3.3058)', async () => {
    // 84㎡ 10억 + 114㎡ 17억 두 거래 → 평당가 = (100000+170000)/(84+114) × 3.3058
    mockQueryRaw.mockResolvedValueOnce([{ sumPrice: 100000 + 170000, sumArea: 84 + 114, cnt: BigInt(2) }]);
    // 나머지 17개는 0건
    for (let i = 0; i < 17; i++) {
      mockQueryRaw.mockResolvedValueOnce([{ sumPrice: null, sumArea: null, cnt: BigInt(0) }]);
    }
    const trends = await getRealEstateTrends();
    expect(trends[0].pricePerPyeong).toBeCloseTo(expectedPpp(270000, 198), 3);
    expect(trends[0].txnCount).toBe(2);
  });

  it('returns null pricePerPyeong and changePct when current period has 0 rows', async () => {
    mockQueryRaw.mockResolvedValue([{ sumPrice: null, sumArea: null, cnt: BigInt(0) }]);

    const trends = await getRealEstateTrends();
    expect(trends).toHaveLength(9);
    for (const t of trends) {
      expect(t.pricePerPyeong).toBeNull();
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

  // helper: 한 단지의 주력 평형 거래 raw rows 생성
  function mkRows(
    buildingName: string,
    city: string,
    district: string,
    txnCount: number,
    representativeArea: number,
    prices: number[],
    monthlies?: number[],
  ) {
    return prices.map((p, i) => ({
      buildingName, city, district,
      txnCount: BigInt(txnCount),
      representativeArea,
      price: p,
      monthlyRent: monthlies ? monthlies[i] : null,
    }));
  }

  it('returns 3 lists (sale/jeonse/wolse) with median price of representative area', async () => {
    mockQueryRaw
      // sale — 헬리오시티 84㎡ 3건(180000, 184000, 188000) + 은마 76㎡ 3건(260000, 267000, 270000)
      .mockResolvedValueOnce([
        ...mkRows('헬리오시티', '서울특별시', '송파구', 17, 85, [180000, 184000, 188000]),
        ...mkRows('은마아파트', '서울특별시', '강남구', 14, 75, [260000, 267000, 270000]),
      ])
      // jeonse — 파크리오 85㎡ 4건 짝수 → 중앙값=두 가운데 평균
      .mockResolvedValueOnce(
        mkRows('파크리오', '서울특별시', '송파구', 22, 85, [80000, 84000, 86000, 90000]),
      )
      // wolse — 아크로리버파크 85㎡ 3건 (deposit, monthlyRent)
      .mockResolvedValueOnce(
        mkRows('아크로리버파크', '서울특별시', '서초구', 9, 85, [18000, 20000, 22000], [110, 120, 130]),
      );

    const result = await getTrendingBuildings();

    expect(result.sale[0]).toMatchObject({
      buildingName: '헬리오시티',
      txnCount: 17,
      representativeArea: 85,
      medianPrice: 184000, // 3건 중앙값
      medianMonthlyRent: null,
    });
    expect(result.sale[0].slug).toBe(encodeURIComponent('헬리오시티'));
    expect(result.sale[1]).toMatchObject({ buildingName: '은마아파트', medianPrice: 267000, representativeArea: 75 });

    expect(result.jeonse[0]).toMatchObject({
      buildingName: '파크리오',
      txnCount: 22,
      representativeArea: 85,
      medianPrice: (84000 + 86000) / 2, // 짝수 — 두 가운데 평균
    });

    expect(result.wolse[0]).toMatchObject({
      buildingName: '아크로리버파크',
      representativeArea: 85,
      medianPrice: 20000,
      medianMonthlyRent: 120,
    });
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

  // $queryRaw sequence: 2 (stats) + 18 (trends) + 3 (buildings) = 23 total
  const sumRow = (sumPrice: number | null, cnt: number) =>
    ({ sumPrice, sumArea: sumPrice === null ? null : 1, cnt: BigInt(cnt) });
  mockQueryRaw
    .mockResolvedValueOnce([{ cnt: BigInt(500) }])                                            // stats: evCharger
    .mockResolvedValueOnce([{ apt: BigInt(20000), villa: BigInt(8000), offitel: BigInt(2000) }]) // stats: buildingCount
    .mockResolvedValueOnce([sumRow(54000, 100)])  // trends: aptCurr
    .mockResolvedValueOnce([sumRow(52000, 90)])   // trends: aptPrev
    .mockResolvedValueOnce([sumRow(30000, 80)])   // trends: aptJeonseCurr
    .mockResolvedValueOnce([sumRow(31000, 85)])   // trends: aptJeonsePrev
    .mockResolvedValueOnce([sumRow(85, 50)])      // trends: aptWolseCurr
    .mockResolvedValueOnce([sumRow(80, 45)])      // trends: aptWolsePrev
    .mockResolvedValueOnce([sumRow(18000, 60)])   // trends: villaCurr
    .mockResolvedValueOnce([sumRow(17500, 55)])   // trends: villaPrev
    .mockResolvedValueOnce([sumRow(12000, 40)])   // trends: villaJeonseCurr
    .mockResolvedValueOnce([sumRow(11800, 38)])   // trends: villaJeonsePrev
    .mockResolvedValueOnce([sumRow(55, 25)])      // trends: villaWolseCurr
    .mockResolvedValueOnce([sumRow(52, 22)])      // trends: villaWolsePrev
    .mockResolvedValueOnce([sumRow(22000, 30)])   // trends: offCurr
    .mockResolvedValueOnce([sumRow(null, 0)])     // trends: offPrev
    .mockResolvedValueOnce([sumRow(15000, 20)])   // trends: offJeonseCurr
    .mockResolvedValueOnce([sumRow(14800, 18)])   // trends: offJeonsePrev
    .mockResolvedValueOnce([sumRow(72, 12)])      // trends: offWolseCurr
    .mockResolvedValueOnce([sumRow(68, 10)])      // trends: offWolsePrev
    .mockResolvedValueOnce([])                    // buildings: sale
    .mockResolvedValueOnce([])                    // buildings: jeonse
    .mockResolvedValueOnce([]);                   // buildings: wolse

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
    mockGetPropertyHotspots.mockReset();
    mockGetPropertyHotspots.mockResolvedValue({
      sale:   { rising: [], falling: [], active: [] },
      jeonse: { rising: [], falling: [], active: [] },
      wolse:  { active: [] },
    });
  });

  it('returns composite payload from all helpers', async () => {
    setupFullMocks();

    const result = await getHomeDashboard();
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('newlyListedToday');
    expect(result.realEstateTrends).toHaveLength(9);
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

  it('includes realEstateHotspots.apt populated by getPropertyHotspots', async () => {
    mockGetPropertyHotspots.mockResolvedValue({
      sale:   { rising: [{ citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
                           pricePerPyeong: 5000, txnCount: 100, changePct: 5, volumeChangePct: 10 }],
                falling: [], active: [] },
      jeonse: { rising: [], falling: [], active: [] },
      wolse:  { active: [] },
    });

    setupFullMocks();

    const result = await getHomeDashboard();
    expect(result.realEstateHotspots).toBeDefined();
    expect(result.realEstateHotspots!.apt).toBeDefined();
    expect(result.realEstateHotspots!.apt!.sale.rising).toHaveLength(1);
    expect(result.realEstateHotspots!.apt!.sale.rising[0].district).toBe('강남구');
  });
});
