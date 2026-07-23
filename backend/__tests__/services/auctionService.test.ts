// backend/__tests__/services/auctionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auctionItem: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    auctionAreaSummary: { findMany: vi.fn() },
    landAreaSummary: { findUnique: vi.fn(), findFirst: vi.fn() },
    aptSaleTransaction: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: mockPrisma, default: mockPrisma }));

import { getItems, getItemDetail, getRanking } from '../../src/services/auctionService.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('getItems', () => {
  it('기본 정렬: 상태 우선순위 raw로 id 조회 후 Prisma로 행 조회 + BigInt 직렬화', async () => {
    mockPrisma.auctionItem.count.mockResolvedValue(1);
    // 기본(browse) 정렬은 정렬된 id를 raw로 뽑는다.
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: 1, cltrMngNo: 'A', apslAssAmt: 300000000n, minBidPrc: 210000000n, usageGroup: 'residential' },
    ]);
    const r = await getItems({ usage: 'residential', page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].apslAssAmt).toBe(300000000); // Number
    // 상태 우선순위 정렬은 raw 경로를 사용한다.
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    // 실제 행은 id로 Prisma에서 조회한다.
    expect(mockPrisma.auctionItem.findMany).toHaveBeenCalledWith({ where: { id: { in: [1] } } });
  });

  it('명시적 정렬(apsl)은 raw 없이 Prisma orderBy를 사용한다', async () => {
    mockPrisma.auctionItem.count.mockResolvedValue(1);
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: 2, cltrMngNo: 'B', apslAssAmt: 500000000n, usageGroup: 'land' },
    ]);
    const r = await getItems({ sort: 'apsl', page: 1, limit: 20 });
    expect(r.items[0].apslAssAmt).toBe(500000000);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.auctionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { apslAssAmt: 'desc' } }),
    );
  });
});

describe('getItemDetail', () => {
  it('cltrMngNo로 단건 + 직렬화', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue({
      id: 1, cltrMngNo: 'A', winBidPrc: 850000000n, bidRate: { toNumber: () => 85 },
      usageGroup: 'etc', bjdCode: '11680', dongName: null, landArea: null, apslAssAmt: null,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]);
    const r = await getItemDetail('A');
    expect(r?.item.cltrMngNo).toBe('A');
    expect(r?.item.winBidPrc).toBe(850000000);
    expect(r?.item.bidRate).toBe(85);
    expect(r?.marketCompare).toBeNull(); // usageGroup=etc → null
  });
  it('없으면 null', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue(null);
    expect(await getItemDetail('X')).toBeNull();
  });
  it('land: LandAreaSummary 조회 → marketCompare 반환 (원/평 단위)', async () => {
    // landArea=330.5㎡ = 100평, apslAssAmt=500_000_000원 → 평당=5_000_000원/평
    // avgPricePerPyeong=400만원/평 → marketAvg=40_000_000원/평
    mockPrisma.auctionItem.findUnique.mockResolvedValue({
      id: 2, cltrMngNo: 'B', usageGroup: 'land', bjdCode: '11680',
      dongName: '역삼동', landArea: { toNumber: () => 330.5 }, apslAssAmt: 500_000_000n,
      winBidPrc: null, bidRate: null,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]);
    mockPrisma.landAreaSummary.findUnique.mockResolvedValue({
      avgPricePerPyeong: { toNumber: () => 400 }, dongName: '역삼동', district: '강남구',
    });
    const r = await getItemDetail('B');
    expect(r?.marketCompare).not.toBeNull();
    expect(r?.marketCompare?.marketAvg).toBe(4_000_000); // 400만원/평 × 10000 = 40_000_000? No: 400 × 10000 = 4_000_000원/평
    expect(r?.marketCompare?.label).toContain('역삼동');
    // apslAssAmtForCompare: 500_000_000 ÷ (330.5/3.305) = 500_000_000 ÷ 100 = 5_000_000
    expect(r?.marketCompare?.apslAssAmtForCompare).toBe(5_000_000);
  });
  it('land: landArea 없으면 marketCompare=null', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue({
      id: 3, cltrMngNo: 'C', usageGroup: 'land', bjdCode: '11680',
      dongName: '역삼동', landArea: null, apslAssAmt: 300_000_000n,
      winBidPrc: null, bidRate: null,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]);
    const r = await getItemDetail('C');
    expect(r?.marketCompare).toBeNull();
  });
  it('residential: 감정가(물건 전체) vs 단일세대 평균 단위 부정확 → marketCompare=null', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue({
      id: 4, cltrMngNo: 'D', usageGroup: 'residential', bjdCode: '11680',
      dongName: '역삼동', landArea: null, apslAssAmt: 800_000_000n,
      winBidPrc: null, bidRate: null,
    });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]);
    const r = await getItemDetail('D');
    expect(r?.marketCompare).toBeNull();
  });
});

describe('getRanking', () => {
  it('isIndexable 집계만 낙찰가율 정렬', async () => {
    mockPrisma.auctionAreaSummary.findMany.mockResolvedValue([
      { bjdCode: '11680', usageGroup: 'residential', city: '서울특별시', district: '강남구', avgBidRate: { toNumber: () => 82 }, soldCount: 10 },
    ]);
    const r = await getRanking({ usage: 'residential', order: 'high', limit: 20 });
    expect(r[0].avgBidRate).toBe(82);
  });
});
