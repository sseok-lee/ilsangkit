// backend/__tests__/services/auctionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auctionItem: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    auctionAreaSummary: { findMany: vi.fn() },
  },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: mockPrisma, default: mockPrisma }));

import { getItems, getItemDetail, getRanking } from '../../src/services/auctionService.js';

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
    mockPrisma.auctionItem.findUnique.mockResolvedValue({ id: 1, cltrMngNo: 'A', winBidPrc: 850000000n, bidRate: { toNumber: () => 85 } });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]); // 같은 시군구 다른 물건
    const r = await getItemDetail('A');
    expect(r?.item.cltrMngNo).toBe('A');
    expect(r?.item.winBidPrc).toBe(850000000);
    expect(r?.item.bidRate).toBe(85);
  });
  it('없으면 null', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue(null);
    expect(await getItemDetail('X')).toBeNull();
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
