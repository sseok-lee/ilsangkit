import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSummaryFindMany, mockSummaryCount } = vi.hoisted(() => ({
  mockSummaryFindMany: vi.fn(),
  mockSummaryCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landAreaSummary: { findMany: mockSummaryFindMany, count: mockSummaryCount },
  },
}));

import { getRegionList } from '../../src/services/landService.js';

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
        where: { city: '서울특별시', district: '강남구' },
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
