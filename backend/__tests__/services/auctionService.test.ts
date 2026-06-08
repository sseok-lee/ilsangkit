// backend/__tests__/services/auctionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auctionItem: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    auctionAreaSummary: { findMany: vi.fn() },
    landAreaSummary: { findUnique: vi.fn(), findFirst: vi.fn() },
    aptSaleTransaction: { aggregate: vi.fn() },
  },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: mockPrisma, default: mockPrisma }));

const { mockFacilitySearch, mockFindNearbyStations } = vi.hoisted(() => ({
  mockFacilitySearch: vi.fn(),
  mockFindNearbyStations: vi.fn(),
}));
vi.mock('../../src/services/facilityService.js', () => ({ search: mockFacilitySearch }));
vi.mock('../../src/services/subwayService.js', () => ({ findNearbyStations: mockFindNearbyStations }));

import { getItems, getItemDetail, getRanking, computeNearbyFacilities } from '../../src/services/auctionService.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('getItems', () => {
  it('필터+페이징, BigInt 직렬화', async () => {
    mockPrisma.auctionItem.count.mockResolvedValue(1);
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: 1, cltrMngNo: 'A', apslAssAmt: 300000000n, minBidPrc: 210000000n, usageGroup: 'residential' },
    ]);
    const r = await getItems({ usage: 'residential', page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].apslAssAmt).toBe(300000000); // Number
    expect(mockPrisma.auctionItem.findMany).toHaveBeenCalled();
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

describe('computeNearbyFacilities', () => {
  it('좌표 없으면 빈 배열(서비스 호출 안 함)', async () => {
    const r = await computeNearbyFacilities(null, null);
    expect(r).toEqual([]);
    expect(mockFacilitySearch).not.toHaveBeenCalled();
    expect(mockFindNearbyStations).not.toHaveBeenCalled();
  });
  it('지하철+카테고리 top3 수집, distance 포함', async () => {
    mockFindNearbyStations.mockResolvedValue([
      { name: '강남역', distance: 120 }, { name: '역삼역', distance: 400 },
    ]);
    mockFacilitySearch.mockImplementation(async ({ category }: { category: string }) => ({
      items: [{ name: `${category}1`, category, distance: 50 }, { name: `${category}2`, category, distance: 90 }],
      total: 2, page: 1, totalPages: 1,
    }));
    const r = await computeNearbyFacilities(37.5, 127.0);
    const subway = r.filter((f) => f.category === 'subway');
    expect(subway).toHaveLength(2);
    expect(subway[0]).toMatchObject({ categoryLabel: '지하철역', name: '강남역', distance: 120 });
    // 5개 시설 카테고리 × 2건 + 지하철 2건 = 12
    expect(r).toHaveLength(12);
    expect(r.some((f) => f.categoryLabel === '병원')).toBe(true);
  });
  it('한 소스 실패해도 나머지 반환', async () => {
    mockFindNearbyStations.mockRejectedValue(new Error('subway down'));
    mockFacilitySearch.mockResolvedValue({ items: [{ name: 'h1', category: 'hospital', distance: 30 }], total: 1, page: 1, totalPages: 1 });
    const r = await computeNearbyFacilities(37.5, 127.0);
    expect(r.some((f) => f.category === 'subway')).toBe(false);
    expect(r.some((f) => f.categoryLabel === '병원')).toBe(true);
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
