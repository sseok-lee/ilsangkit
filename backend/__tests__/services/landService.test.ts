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

import { getRegionList, getRegionDetail, getHubSummary } from '../../src/services/landService.js';

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

  it('거래내역 + 평당가 시계열 + 지목/용도지역 분포 반환', async () => {
    const rows = [
      { id: 1, jibun: '123-4', jimok: '대', landUse: '제2종일반주거지역', dealArea: 198.3,
        shareDeal: false, dealAmount: 1500000n, dealType: '중개거래', dealYear: 2026, dealMonth: 3, dealDay: 15 },
      { id: 2, jibun: '567', jimok: '전', landUse: '계획관리지역', dealArea: 330,
        shareDeal: false, dealAmount: 990000n, dealType: '직거래', dealYear: 2026, dealMonth: 1, dealDay: 5 },
    ];
    mockTxnFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);
    mockTxnCount.mockResolvedValue(2);

    const r = await getRegionDetail({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });

    expect(r.total).toBe(2);
    expect(r.items[0].pricePerPyeong).toBeGreaterThan(0);
    expect(r.items[0].dealAmount).toBe(1500000); // BigInt → number

    // jimokDistribution: now includes avgPricePerPyeong per jimok
    expect(r.jimokDistribution).toEqual(expect.arrayContaining([
      expect.objectContaining({ jimok: '대', count: 1 }),
      expect.objectContaining({ jimok: '전', count: 1 }),
    ]));
    const dae = r.jimokDistribution.find((d: any) => d.jimok === '대');
    expect(dae.avgPricePerPyeong).toBeGreaterThan(0);

    expect(r.landUseDistribution).toEqual(expect.arrayContaining([
      { landUse: '제2종일반주거지역', count: 1 }, { landUse: '계획관리지역', count: 1 },
    ]));

    // priceTimeline: 대지(jimok=대) only → only row1 (2026-3), row2 '전' excluded
    expect(r.priceTimeline.length).toBeGreaterThan(0);
    expect(r.priceTimeline[0]).toHaveProperty('year');
    expect(r.priceTimeline[0]).toHaveProperty('avgPricePerPyeong');
    expect(r.priceTimeline[0].avgPricePerPyeong).toBeGreaterThan(0);

    // daeCount: only the '대' row
    expect(r.daeCount).toBe(1);
  });
});

describe('getHubSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('시·도별 색인가능 동 수와 거래 합계 집계', async () => {
    mockSummaryFindMany.mockResolvedValue([
      { city: '서울특별시', transactionCount: 12, isIndexable: true },
      { city: '서울특별시', transactionCount: 3, isIndexable: false },
      { city: '경기도', transactionCount: 20, isIndexable: true },
    ]);

    const r = await getHubSummary();

    const seoul = r.cities.find((c) => c.city === '서울특별시');
    expect(seoul?.indexableDongCount).toBe(1);
    expect(seoul?.totalTransactions).toBe(15);
    expect(seoul?.slug).toBe('seoul');
    expect(r.totalTransactions).toBe(35);
  });
});
