import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSummaryFindMany, mockSummaryCount, mockTxnFindMany, mockTxnCount } = vi.hoisted(() => ({
  mockSummaryFindMany: vi.fn(),
  mockSummaryCount: vi.fn(),
  mockTxnFindMany: vi.fn(),
  mockTxnCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landAreaSummary: { findMany: mockSummaryFindMany, count: mockSummaryCount },
    landSaleTransaction: { findMany: mockTxnFindMany, count: mockTxnCount },
  },
}));

import { getRegionList, getRegionDetail, getHubSummary, getSitemapEntries, getTransactions } from '../../src/services/landService.js';

describe('getRegionList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('동 목록을 transactionCount 내림차순으로 반환 + 페이지네이션', async () => {
    mockSummaryFindMany.mockResolvedValue([
      { bjdCode: '11680', dongName: '역삼동', city: '서울특별시', district: '강남구',
        transactionCount: 12, avgPricePerPyeong: '25000', latestDealDate: new Date('2026-03-15'), isIndexable: true },
    ]);
    mockSummaryCount.mockResolvedValue(1);

    const r = await getRegionList({ city: '서울특별시', district: '강남구', page: 1, limit: 20 });

    expect(r.total).toBe(1);
    expect(r.items[0].dongName).toBe('역삼동');
    expect(r.items[0].avgPricePerPyeong).toBe(25000); // Decimal/string → number
    expect(mockSummaryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { city: { in: expect.arrayContaining(['서울특별시', '서울']) }, district: '강남구' },
        orderBy: { transactionCount: 'desc' },
        skip: 0,
        take: 20,
      })
    );
  });

  it('필터 없으면 where 빈 객체', async () => {
    mockSummaryFindMany.mockResolvedValue([]);
    mockSummaryCount.mockResolvedValue(0);
    await getRegionList({ page: 1, limit: 20 });
    expect(mockSummaryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('getRegionDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('거래내역 + 분기별 평당가 시계열 + 지목그룹/용도지역 분포 + 대지사례 반환', async () => {
    const rows = [
      // 비지분 대지 — 헤드라인, daeSamples, priceTimeline에 포함
      { id: 1, jibun: '123-4', jimok: '대', landUse: '제2종일반주거지역', dealArea: 198.3,
        shareDeal: false, dealAmount: 1500000n, dealType: '중개거래', dealYear: 2026, dealMonth: 3, dealDay: 15 },
      // 농지(전)
      { id: 2, jibun: '567', jimok: '전', landUse: '계획관리지역', dealArea: 330,
        shareDeal: false, dealAmount: 990000n, dealType: '직거래', dealYear: 2026, dealMonth: 1, dealDay: 5 },
      // 지분 대지 — daeCount에는 포함, daeSamples·priceTimeline·jimokGroups대지평당가 제외
      { id: 3, jibun: '99-1', jimok: '대', landUse: '제2종일반주거지역', dealArea: 7.74,
        shareDeal: true, dealAmount: 14200n, dealType: '직거래', dealYear: 2026, dealMonth: 2, dealDay: 10 },
      // 도로
      { id: 4, jibun: '1-1', jimok: '도로', landUse: '도로', dealArea: 50,
        shareDeal: false, dealAmount: 5000n, dealType: '직거래', dealYear: 2025, dealMonth: 6, dealDay: 1 },
    ];
    mockTxnFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);
    mockTxnCount.mockResolvedValue(4);

    const r = await getRegionDetail({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });

    expect(r.total).toBe(4);
    expect(r.items[0].pricePerPyeong).toBeGreaterThan(0);
    expect(r.items[0].dealAmount).toBe(1500000); // BigInt → number

    // jimokGroups: 대지(2건), 농지(1건), 도로·기타(1건)
    expect(r.jimokGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: '대지', count: 2 }),
      expect.objectContaining({ group: '농지', count: 1 }),
      expect.objectContaining({ group: '도로·기타', count: 1 }),
    ]));
    const daeGroup = r.jimokGroups.find((g: any) => g.group === '대지');
    // 대지그룹 평당가는 비지분(id=1)만 반영
    expect(daeGroup.avgPricePerPyeong).toBeGreaterThan(0);
    // 지분 대지(id=3, dealAmount=14200, dealArea=7.74)를 포함하면 평균이 왜곡됨 → 비지분만임을 확인
    expect(daeGroup.avgPricePerPyeong).toBeGreaterThan(24000);
    expect(daeGroup.avgPricePerPyeong).toBeLessThan(26000);

    expect(r.landUseDistribution).toEqual(expect.arrayContaining([
      { landUse: '제2종일반주거지역', count: 2 },
      { landUse: '계획관리지역', count: 1 },
    ]));

    // priceTimeline: 비지분 대지 only → id=1(2026-Q1), id=3(지분) 제외
    expect(r.priceTimeline.length).toBeGreaterThan(0);
    expect(r.priceTimeline[0]).toHaveProperty('year');
    expect(r.priceTimeline[0]).toHaveProperty('quarter');
    expect(r.priceTimeline[0]).toHaveProperty('avgPricePerPyeong');
    expect(r.priceTimeline[0].avgPricePerPyeong).toBeGreaterThan(0);

    // daeCount: 비지분(1) + 지분(1) = 2
    expect(r.daeCount).toBe(2);
    // daeNonShareCount: 비지분만 = 1
    expect(r.daeNonShareCount).toBe(1);

    // daeSamples: 비지분 대지만 (id=1만 해당), 최신순
    expect(r.daeSamples).toHaveLength(1);
    expect(r.daeSamples[0].id).toBe(1);
    expect(r.daeSamples[0].shareDeal).toBe(false);
    expect(r.daeSamples[0].pricePerPyeong).toBeGreaterThan(0);
  });
});

describe('getHubSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  // 색인가능 판정은 저장된 isIndexable 이 아니라 transactionCount >= 3 이다
  // (상세 페이지의 판정과 같은 술어여야 한다 — landIndexabilityParity.test.ts 참고).
  // 아래 fixture 의 `isIndexable: false, transactionCount: 3` 은 sync 시점 규칙
  // (recent>=5 || total>=10)으로는 제외였지만 지금은 색인 대상이다.
  it('시·도별 색인가능 동 수와 거래 합계 집계 — 저장된 플래그가 아닌 거래 건수로 센다', async () => {
    mockSummaryFindMany.mockResolvedValue([
      { city: '서울특별시', transactionCount: 12, isIndexable: true },
      { city: '서울특별시', transactionCount: 3, isIndexable: false },
      { city: '서울특별시', transactionCount: 2, isIndexable: false },
      { city: '경기도', transactionCount: 20, isIndexable: true },
    ]);

    const r = await getHubSummary();

    const seoul = r.cities.find((c) => c.city === '서울특별시');
    expect(seoul?.indexableDongCount).toBe(2);
    expect(seoul?.totalTransactions).toBe(17);
    expect(seoul?.slug).toBe('seoul');
    expect(r.totalTransactions).toBe(37);
  });
});

describe('getTransactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bjdCode/dongName 기준 페이지네이션 items + total + totalPages 반환', async () => {
    mockTxnFindMany.mockResolvedValue([
      { id: 1, jibun: '123-4', jimok: '대', landUse: '제2종일반주거지역', dealArea: 198.3,
        shareDeal: false, dealAmount: 1500000n, dealType: '중개거래', dealYear: 2026, dealMonth: 3, dealDay: 15 },
    ]);
    mockTxnCount.mockResolvedValue(42);

    const r = await getTransactions({ bjdCode: '11680', dongName: '역삼동', page: 2, limit: 20 });

    expect(r.total).toBe(42);
    expect(r.page).toBe(2);
    expect(r.totalPages).toBe(3); // ceil(42/20)
    expect(r.items).toHaveLength(1);
    expect(r.items[0].dealAmount).toBe(1500000); // BigInt → number
    expect(r.items[0].pricePerPyeong).toBeGreaterThan(0);

    expect(mockTxnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', dongName: '역삼동', cancelDealDay: null },
        orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
        skip: 20, // (page 2 - 1) * 20
        take: 20,
      })
    );
    expect(mockTxnCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bjdCode: '11680', dongName: '역삼동', cancelDealDay: null } })
    );
  });

  it('total=0 이면 totalPages=0', async () => {
    mockTxnFindMany.mockResolvedValue([]);
    mockTxnCount.mockResolvedValue(0);
    const r = await getTransactions({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });
    expect(r.totalPages).toBe(0);
    expect(r.items).toHaveLength(0);
  });

  it('page=1 일 때 skip=0', async () => {
    mockTxnFindMany.mockResolvedValue([]);
    mockTxnCount.mockResolvedValue(5);
    await getTransactions({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });
    expect(mockTxnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

describe('getSitemapEntries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('distinct (city, district) pairs와 거래 3건 이상 동만 반환', async () => {
    // First call: distinct city/district pairs
    mockSummaryFindMany.mockResolvedValueOnce([
      { city: '서울', district: '강남구' },
      { city: '서울', district: '강북구' },
      { city: '경기', district: '성남시분당구' },
    ]);
    // Second call: indexable dongs only
    mockSummaryFindMany.mockResolvedValueOnce([
      { city: '서울', district: '강남구', dongName: '역삼동' },
      { city: '서울', district: '강남구', dongName: '삼성동' },
      // 강북구 has no indexable dongs
    ]);

    const result = await getSitemapEntries();

    expect(result.cities).toHaveLength(3);
    expect(result.cities).toEqual(expect.arrayContaining([
      { city: '서울', district: '강남구' },
      { city: '서울', district: '강북구' },
      { city: '경기', district: '성남시분당구' },
    ]));

    expect(result.indexableDongs).toHaveLength(2);
    expect(result.indexableDongs).toEqual(expect.arrayContaining([
      { city: '서울', district: '강남구', dongName: '역삼동' },
      { city: '서울', district: '강남구', dongName: '삼성동' },
    ]));

    // First call: distinct city/district
    expect(mockSummaryFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      distinct: ['city', 'district'],
      select: { city: true, district: true },
    }));
    // Second call: 거래 건수 임계값 필터 (저장된 isIndexable 이 아니다)
    expect(mockSummaryFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { transactionCount: { gte: 3 } },
      select: { city: true, district: true, dongName: true },
    }));
  });

  it('임계값 미만 동은 indexableDongs에 포함되지 않는다', async () => {
    mockSummaryFindMany.mockResolvedValueOnce([
      { city: '서울', district: '강남구' },
    ]);
    // Empty — no indexable dongs
    mockSummaryFindMany.mockResolvedValueOnce([]);

    const result = await getSitemapEntries();

    expect(result.cities).toHaveLength(1);
    expect(result.indexableDongs).toHaveLength(0);
  });
});
