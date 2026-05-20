import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockFindMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    realEstateBuildingSummary: { findMany: mockFindMany },
  },
  default: {
    $queryRaw: mockQueryRaw,
    realEstateBuildingSummary: { findMany: mockFindMany },
  },
}));

import { getNearbyByBjd } from '../../src/services/realEstateService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockFindMany.mockReset();
});

describe('getNearbyComplexes (rent path)', () => {
  it('returns latestDealYear/Month from the actual latest row (not max of each column)', async () => {
    // Rent path runs raw SQL 3 times (apt/villa/offitel)
    mockQueryRaw.mockResolvedValue([
      {
        buildingName: '강남타워',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        dongName: '역삼동',
        buildYear: 2010,
        transactionCount: 5n,
        latestPrice: 50000n,
        monthlyRent: 100n,
        latestDealYear: 2026,
        latestDealMonth: 6, // critical: this should be 6, not 12 from an unrelated row
      },
    ]);

    const result = await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(result.apt).toHaveLength(1);
    expect(result.apt[0].latestDealYear).toBe(2026);
    expect(result.apt[0].latestDealMonth).toBe(6);
    expect(result.apt[0].latestPrice).toBe(50000);
    expect(result.apt[0].monthlyRent).toBe(100);
    expect(result.apt[0].transactionCount).toBe(5);
  });

  it('calls $queryRaw 3 times (apt, villa, offitel)', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('returns empty arrays for all 3 keys when no rows found', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(result.apt).toEqual([]);
    expect(result.villa).toEqual([]);
    expect(result.offitel).toEqual([]);
  });

  it('converts BigInt transactionCount/latestPrice/monthlyRent to Number', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        buildingName: '테스트빌딩',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        dongName: '역삼동',
        buildYear: 2005,
        transactionCount: 10n,
        latestPrice: 30000n,
        monthlyRent: 50n,
        latestDealYear: 2025,
        latestDealMonth: 3,
      },
    ]);

    const result = await getNearbyByBjd('1168010100', 'rent', { rentType: 'jeonse' });

    const item = result.apt[0];
    expect(typeof item.transactionCount).toBe('number');
    expect(typeof item.latestPrice).toBe('number');
    expect(typeof item.monthlyRent).toBe('number');
    expect(item.transactionCount).toBe(10);
    expect(item.latestPrice).toBe(30000);
    expect(item.monthlyRent).toBe(50);
  });

  it('converts BigInt buildYear/latestDealYear/latestDealMonth to Number (JSON serialize 가능)', async () => {
    // ANY_VALUE / window function 결과가 Prisma raw에서 BigInt로 들어올 수 있음
    mockQueryRaw.mockResolvedValue([
      {
        buildingName: '반포미도',
        bjdCode: '1165010600',
        city: '서울특별시',
        district: '서초구',
        dongName: '반포동',
        buildYear: 1988n,             // BigInt
        transactionCount: 7n,
        latestPrice: 80000n,
        monthlyRent: 0n,
        latestDealYear: 2026n,        // BigInt
        latestDealMonth: 3n,          // BigInt
      },
    ]);

    const result = await getNearbyByBjd('1165010600', 'rent', { rentType: 'all' });

    const item = result.apt[0];
    expect(typeof item.buildYear).toBe('number');
    expect(typeof item.latestDealYear).toBe('number');
    expect(typeof item.latestDealMonth).toBe('number');
    expect(item.buildYear).toBe(1988);
    expect(item.latestDealYear).toBe(2026);
    expect(item.latestDealMonth).toBe(3);
    // JSON serialize 가능 여부도 확인 (BigInt 남아있으면 throw)
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
