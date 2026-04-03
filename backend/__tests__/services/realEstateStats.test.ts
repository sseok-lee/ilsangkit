/**
 * Tests for new realEstateService features:
 * TEST-1: getTransactionStats exclusiveArea ±2㎡ filter
 * TEST-2: getTransactionStats rentType filter + priceField selection
 * TEST-3: getTransactionStats changeRate / StatsSummary calculation
 * TEST-4: getAreaGroups area grouping logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (same pattern as realEstateService.test.ts) ───────────────
const {
  mockAptSaleGroupBy,
  mockAptRentGroupBy,
  mockVillaSaleGroupBy,
  mockVillaRentGroupBy,
  mockOffitelSaleGroupBy,
  mockOffitelRentGroupBy,
  mockAptSaleFindMany,
  mockAptSaleCount,
  mockAptRentFindMany,
  mockAptRentCount,
  mockVillaSaleFindMany,
  mockVillaSaleCount,
  mockVillaRentFindMany,
  mockVillaRentCount,
  mockOffitelSaleFindMany,
  mockOffitelSaleCount,
  mockOffitelRentFindMany,
  mockOffitelRentCount,
  mockAptSaleFindFirst,
  mockAptRentFindFirst,
  mockVillaSaleFindFirst,
  mockVillaRentFindFirst,
  mockOffitelSaleFindFirst,
  mockOffitelRentFindFirst,
  mockAptSaleAggregate,
  mockAptRentAggregate,
  mockVillaSaleAggregate,
  mockVillaRentAggregate,
  mockOffitelSaleAggregate,
  mockOffitelRentAggregate,
  mockQueryRawUnsafe,
  mockSummaryFindMany,
  mockSummaryCount,
} = vi.hoisted(() => ({
  mockAptSaleGroupBy: vi.fn(),
  mockAptRentGroupBy: vi.fn(),
  mockVillaSaleGroupBy: vi.fn(),
  mockVillaRentGroupBy: vi.fn(),
  mockOffitelSaleGroupBy: vi.fn(),
  mockOffitelRentGroupBy: vi.fn(),
  mockAptSaleFindMany: vi.fn(),
  mockAptSaleCount: vi.fn(),
  mockAptRentFindMany: vi.fn(),
  mockAptRentCount: vi.fn(),
  mockVillaSaleFindMany: vi.fn(),
  mockVillaSaleCount: vi.fn(),
  mockVillaRentFindMany: vi.fn(),
  mockVillaRentCount: vi.fn(),
  mockOffitelSaleFindMany: vi.fn(),
  mockOffitelSaleCount: vi.fn(),
  mockOffitelRentFindMany: vi.fn(),
  mockOffitelRentCount: vi.fn(),
  mockAptSaleFindFirst: vi.fn(),
  mockAptRentFindFirst: vi.fn(),
  mockVillaSaleFindFirst: vi.fn(),
  mockVillaRentFindFirst: vi.fn(),
  mockOffitelSaleFindFirst: vi.fn(),
  mockOffitelRentFindFirst: vi.fn(),
  mockAptSaleAggregate: vi.fn(),
  mockAptRentAggregate: vi.fn(),
  mockVillaSaleAggregate: vi.fn(),
  mockVillaRentAggregate: vi.fn(),
  mockOffitelSaleAggregate: vi.fn(),
  mockOffitelRentAggregate: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
  mockSummaryFindMany: vi.fn(),
  mockSummaryCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const models = {
    aptSaleTransaction: {
      findMany: mockAptSaleFindMany,
      findFirst: mockAptSaleFindFirst,
      count: mockAptSaleCount,
      groupBy: mockAptSaleGroupBy,
      aggregate: mockAptSaleAggregate,
    },
    aptRentTransaction: {
      findMany: mockAptRentFindMany,
      findFirst: mockAptRentFindFirst,
      count: mockAptRentCount,
      groupBy: mockAptRentGroupBy,
      aggregate: mockAptRentAggregate,
    },
    villaSaleTransaction: {
      findMany: mockVillaSaleFindMany,
      findFirst: mockVillaSaleFindFirst,
      count: mockVillaSaleCount,
      groupBy: mockVillaSaleGroupBy,
      aggregate: mockVillaSaleAggregate,
    },
    villaRentTransaction: {
      findMany: mockVillaRentFindMany,
      findFirst: mockVillaRentFindFirst,
      count: mockVillaRentCount,
      groupBy: mockVillaRentGroupBy,
      aggregate: mockVillaRentAggregate,
    },
    offitelSaleTransaction: {
      findMany: mockOffitelSaleFindMany,
      findFirst: mockOffitelSaleFindFirst,
      count: mockOffitelSaleCount,
      groupBy: mockOffitelSaleGroupBy,
      aggregate: mockOffitelSaleAggregate,
    },
    offitelRentTransaction: {
      findMany: mockOffitelRentFindMany,
      findFirst: mockOffitelRentFindFirst,
      count: mockOffitelRentCount,
      groupBy: mockOffitelRentGroupBy,
      aggregate: mockOffitelRentAggregate,
    },
  };
  const summary = {
    realEstateBuildingSummary: {
      findMany: mockSummaryFindMany,
      count: mockSummaryCount,
    },
  };
  return {
    prisma: { ...models, ...summary, $queryRawUnsafe: mockQueryRawUnsafe },
    default: { ...models, ...summary, $queryRawUnsafe: mockQueryRawUnsafe },
  };
});

import {
  getTransactionStats,
  getAreaGroups,
} from '../../src/services/realEstateService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST-1: exclusiveArea ±2㎡ filter
// Requires: task #3 (BE-3) — getTransactionStats에 exclusiveArea ±2㎡ 필터
// ─────────────────────────────────────────────────────────────────────────────
describe('getTransactionStats - exclusiveArea filter (TEST-1)', () => {
  it('passes exclusiveArea ±2㎡ range to groupBy where clause when exclusiveArea=84', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 12, 84);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exclusiveArea: { gte: 82, lte: 86 },
        }),
      })
    );
  });

  it('passes exclusiveArea ±2㎡ range when exclusiveArea=59', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 12, 59);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exclusiveArea: { gte: 57, lte: 61 },
        }),
      })
    );
  });

  it('includes 82㎡ in the filter range for exclusiveArea=84 (gte: 82 satisfied)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 12, 84);

    const where = mockAptSaleGroupBy.mock.calls[0][0].where;
    // 82 satisfies gte:82 → included
    expect(82).toBeGreaterThanOrEqual(where.exclusiveArea.gte);
    expect(82).toBeLessThanOrEqual(where.exclusiveArea.lte);
  });

  it('excludes 81㎡ for exclusiveArea=84 (below gte: 82)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 12, 84);

    const where = mockAptSaleGroupBy.mock.calls[0][0].where;
    // 81 < 82 → excluded
    expect(81).toBeLessThan(where.exclusiveArea.gte);
  });

  it('does not include exclusiveArea in where when not provided', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 12);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          exclusiveArea: expect.anything(),
        }),
      })
    );
  });

  it('applies exclusiveArea filter for villa-sale type', async () => {
    mockVillaSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('villa-sale', '11680', undefined, 12, 84);

    expect(mockVillaSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exclusiveArea: { gte: 82, lte: 86 },
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST-2: rentType filter + priceField selection
// Requires: task #4 (BE-4) — getTransactionStats에 rentType 필터 + 월세 priceField
// ─────────────────────────────────────────────────────────────────────────────
describe('getTransactionStats - rentType filter (TEST-2)', () => {
  it('filters by rentType=전세 and uses deposit as priceField', async () => {
    mockAptRentGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '전세');

    expect(mockAptRentGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rentType: '전세' }),
        _avg: { deposit: true },
        _max: { deposit: true },
        _min: { deposit: true },
        _count: { deposit: true },
      })
    );
  });

  it('filters by rentType=월세 and uses 환산보증금 via raw query', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '월세');

    // 월세는 환산보증금(deposit + monthlyRent * 240)을 raw query로 계산
    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit + monthlyRent * 240');
    expect(sql).toContain('AptRentTransaction');
  });

  it('excludes 월세 transactions when rentType=전세 (where clause filter)', async () => {
    mockAptRentGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '전세');

    const where = mockAptRentGroupBy.mock.calls[0][0].where;
    expect(where.rentType).toBe('전세');
  });

  it('uses 환산보증금 raw query when no rentType filter (전체: 전세+월세 통합)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6);

    // rentType 미지정 시 전세=deposit, 월세=환산보증금 통합 → raw query
    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('CASE WHEN');
    expect(sql).toContain('AptRentTransaction');
  });

  it('uses Prisma groupBy with deposit for 전세 only', async () => {
    mockAptRentGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '전세');

    // 전세 전용은 Prisma groupBy 사용
    expect(mockAptRentGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        _avg: { deposit: true },
      })
    );
  });

  it('applies rentType=월세 filter for villa-rent via raw query', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('villa-rent', '11680', undefined, 6, undefined, '월세');

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit + monthlyRent * 240');
    expect(sql).toContain('VillaRentTransaction');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST-3: StatsSummary — 이동평균 changeRate 계산
// Requires: task #6 (BE-6) — 3개월 이동평균 changeRate 계산 구현
// ─────────────────────────────────────────────────────────────────────────────
describe('getTransactionStats - changeRate summary (TEST-3)', () => {
  // 6 months of data, ascending order (oldest first = index 0):
  // previous 3 (Jan–Mar): avg 80000, 70000, 60000 → previousAvg = 70000
  // recent   3 (Apr–Jun): avg 80000, 90000, 100000 → recentAvg = 90000
  // changeRate = (90000 - 70000) / 70000 * 100 ≈ 28.57%
  const sixMonthsData = [
    { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 80000 }, _max: { dealAmount: 90000 }, _min: { dealAmount: 70000 }, _count: { dealAmount: 3 } },
    { dealYear: 2024, dealMonth: 2, _avg: { dealAmount: 70000 }, _max: { dealAmount: 80000 }, _min: { dealAmount: 60000 }, _count: { dealAmount: 3 } },
    { dealYear: 2024, dealMonth: 3, _avg: { dealAmount: 60000 }, _max: { dealAmount: 70000 }, _min: { dealAmount: 50000 }, _count: { dealAmount: 3 } },
    { dealYear: 2024, dealMonth: 4, _avg: { dealAmount: 80000 }, _max: { dealAmount: 90000 }, _min: { dealAmount: 70000 }, _count: { dealAmount: 3 } },
    { dealYear: 2024, dealMonth: 5, _avg: { dealAmount: 90000 }, _max: { dealAmount: 100000 }, _min: { dealAmount: 80000 }, _count: { dealAmount: 3 } },
    { dealYear: 2024, dealMonth: 6, _avg: { dealAmount: 100000 }, _max: { dealAmount: 110000 }, _min: { dealAmount: 90000 }, _count: { dealAmount: 3 } },
  ];

  it('returns StatsResponse with monthly array and summary object', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result).toHaveProperty('monthly');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray((result as any).monthly)).toBe(true);
  });

  it('calculates recentAvg from most recent 3 months', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // Apr(80000) + May(90000) + Jun(100000) = 270000 / 3 = 90000
    expect((result as any).summary.recentAvg).toBeCloseTo(90000, 0);
  });

  it('calculates previousAvg from prior 3 months', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // Jan(80000) + Feb(70000) + Mar(60000) = 210000 / 3 = 70000
    expect((result as any).summary.previousAvg).toBeCloseTo(70000, 0);
  });

  it('calculates changeRate accurately as percentage', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // (90000 - 70000) / 70000 * 100 ≈ 28.57
    expect((result as any).summary.changeRate).toBeCloseTo(28.57, 1);
  });

  it('sets totalCount to sum of all monthly counts', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // 6 months × 3 transactions = 18
    expect((result as any).summary.totalCount).toBe(18);
  });

  it('sets lowVolume=true when total transaction count < 3', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 80000 }, _max: { dealAmount: 80000 }, _min: { dealAmount: 80000 }, _count: { dealAmount: 1 } },
      { dealYear: 2024, dealMonth: 2, _avg: { dealAmount: 70000 }, _max: { dealAmount: 70000 }, _min: { dealAmount: 70000 }, _count: { dealAmount: 1 } },
    ]);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // totalCount = 2 < 3 → lowVolume true
    expect((result as any).summary.lowVolume).toBe(true);
  });

  it('sets lowVolume=false when total transaction count >= 3', async () => {
    mockAptSaleGroupBy.mockResolvedValue(sixMonthsData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    // totalCount = 18 ≥ 3 → lowVolume false
    expect((result as any).summary.lowVolume).toBe(false);
  });

  it('sets changeRate=null when previousAvg is null (only recent data exists)', async () => {
    // Only 1 month of data — no previous period
    mockAptSaleGroupBy.mockResolvedValue([
      { dealYear: 2024, dealMonth: 6, _avg: { dealAmount: 100000 }, _max: { dealAmount: 110000 }, _min: { dealAmount: 90000 }, _count: { dealAmount: 5 } },
    ]);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect((result as any).summary.changeRate).toBeNull();
  });

  it('sets changeRate=null when recentAvg is null (no data)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect((result as any).summary.changeRate).toBeNull();
    expect((result as any).summary.recentAvg).toBeNull();
    expect((result as any).summary.previousAvg).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST-4: getAreaGroups — area grouping logic
// Implementation already in realEstateService.ts — runs immediately
// ─────────────────────────────────────────────────────────────────────────────
describe('getAreaGroups - area grouping (TEST-4)', () => {
  it('groups 59.96㎡ and 59.98㎡ into same group (both round to 60, |60-60|=0 ≤ 2)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.96, _count: { exclusiveArea: 5 } },
      { exclusiveArea: 59.98, _count: { exclusiveArea: 3 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680', '래미안');

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(8); // 5 + 3
  });

  it('keeps 59㎡ and 84㎡ as separate groups (|59-84|=25 > 2)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.0, _count: { exclusiveArea: 10 } },
      { exclusiveArea: 84.0, _count: { exclusiveArea: 8 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680', '래미안');

    expect(result).toHaveLength(2);
    const areas = result.map((g) => g.area);
    expect(areas).toContain(59);
    expect(areas).toContain(84);
  });

  it('converts 84㎡ to 25평 (Math.round(84/3.305)=25)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 84.0, _count: { exclusiveArea: 10 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0].pyeong).toBe(25); // Math.round(84/3.305) = Math.round(25.416) = 25
  });

  it('converts 59㎡ to 18평 (Math.round(59/3.305)=18)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.0, _count: { exclusiveArea: 10 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0].pyeong).toBe(18); // Math.round(59/3.305) = Math.round(17.852) = 18
  });

  it('sorts groups by area ascending (작은 평수부터)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 84.0, _count: { exclusiveArea: 10 } },
      { exclusiveArea: 59.0, _count: { exclusiveArea: 5 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0].area).toBe(59); // 작은 면적 먼저
    expect(result[1].area).toBe(84); // 큰 면적 나중
  });

  it('calls groupBy on correct model for apt-sale', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockAptRentGroupBy).not.toHaveBeenCalled();
  });

  it('calls groupBy on correct model for apt-rent', async () => {
    mockAptRentGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-rent', '11680');

    expect(mockAptRentGroupBy).toHaveBeenCalledTimes(1);
    expect(mockAptSaleGroupBy).not.toHaveBeenCalled();
  });

  it('filters by bjdCode in groupBy where clause', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680' }),
      })
    );
  });

  it('filters by buildingName when provided', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680', '래미안');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680', buildingName: '래미안' }),
      })
    );
  });

  it('omits buildingName from where when not provided', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ buildingName: expect.anything() }),
      })
    );
  });

  it('returns empty array when no data', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result).toEqual([]);
  });

  it('merges areas exactly 2㎡ apart (e.g., 59 and 61 → same group, |59-61|=2)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.0, _count: { exclusiveArea: 5 } },
      { exclusiveArea: 61.0, _count: { exclusiveArea: 3 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    // |59 - 61| = 2 ≤ 2 → merged
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(8);
  });

  it('does NOT merge areas more than 2㎡ apart (e.g., 59 and 62 → different groups, |59-62|=3)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.0, _count: { exclusiveArea: 5 } },
      { exclusiveArea: 62.0, _count: { exclusiveArea: 3 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    // |59 - 62| = 3 > 2 → separate groups
    expect(result).toHaveLength(2);
  });

  it('returns each group with area, pyeong, and count fields', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 84.0, _count: { exclusiveArea: 7 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0]).toHaveProperty('area', 84);
    expect(result[0]).toHaveProperty('pyeong');
    expect(result[0]).toHaveProperty('count', 7);
  });

  it('throws for unknown type slug', async () => {
    await expect(
      getAreaGroups('unknown-type', '11680')
    ).rejects.toThrow();
  });
});
