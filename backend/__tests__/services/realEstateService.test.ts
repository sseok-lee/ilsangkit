import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for all 6 real estate models
const {
  mockAptSaleFindMany,
  mockAptSaleCount,
  mockAptSaleGroupBy,
  mockAptRentFindMany,
  mockAptRentCount,
  mockAptRentGroupBy,
  mockVillaSaleFindMany,
  mockVillaSaleCount,
  mockVillaSaleGroupBy,
  mockVillaRentFindMany,
  mockVillaRentCount,
  mockVillaRentGroupBy,
  mockOffitelSaleFindMany,
  mockOffitelSaleCount,
  mockOffitelSaleGroupBy,
  mockOffitelRentFindMany,
  mockOffitelRentCount,
  mockOffitelRentGroupBy,
  mockAptSaleFindFirst,
  mockAptRentFindFirst,
  mockVillaSaleFindFirst,
  mockVillaRentFindFirst,
  mockOffitelSaleFindFirst,
  mockOffitelRentFindFirst,
  mockQueryRawUnsafe,
  mockSummaryFindMany,
  mockSummaryCount,
} = vi.hoisted(() => ({
  mockAptSaleFindMany: vi.fn(),
  mockAptSaleCount: vi.fn(),
  mockAptSaleGroupBy: vi.fn(),
  mockAptSaleFindFirst: vi.fn(),
  mockAptRentFindMany: vi.fn(),
  mockAptRentCount: vi.fn(),
  mockAptRentGroupBy: vi.fn(),
  mockAptRentFindFirst: vi.fn(),
  mockVillaSaleFindMany: vi.fn(),
  mockVillaSaleCount: vi.fn(),
  mockVillaSaleGroupBy: vi.fn(),
  mockVillaSaleFindFirst: vi.fn(),
  mockVillaRentFindMany: vi.fn(),
  mockVillaRentCount: vi.fn(),
  mockVillaRentGroupBy: vi.fn(),
  mockVillaRentFindFirst: vi.fn(),
  mockOffitelSaleFindMany: vi.fn(),
  mockOffitelSaleCount: vi.fn(),
  mockOffitelSaleGroupBy: vi.fn(),
  mockOffitelSaleFindFirst: vi.fn(),
  mockOffitelRentFindMany: vi.fn(),
  mockOffitelRentCount: vi.fn(),
  mockOffitelRentGroupBy: vi.fn(),
  mockOffitelRentFindFirst: vi.fn(),
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
    },
    aptRentTransaction: {
      findMany: mockAptRentFindMany,
      findFirst: mockAptRentFindFirst,
      count: mockAptRentCount,
      groupBy: mockAptRentGroupBy,
    },
    villaSaleTransaction: {
      findMany: mockVillaSaleFindMany,
      findFirst: mockVillaSaleFindFirst,
      count: mockVillaSaleCount,
      groupBy: mockVillaSaleGroupBy,
    },
    villaRentTransaction: {
      findMany: mockVillaRentFindMany,
      findFirst: mockVillaRentFindFirst,
      count: mockVillaRentCount,
      groupBy: mockVillaRentGroupBy,
    },
    offitelSaleTransaction: {
      findMany: mockOffitelSaleFindMany,
      findFirst: mockOffitelSaleFindFirst,
      count: mockOffitelSaleCount,
      groupBy: mockOffitelSaleGroupBy,
    },
    offitelRentTransaction: {
      findMany: mockOffitelRentFindMany,
      findFirst: mockOffitelRentFindFirst,
      count: mockOffitelRentCount,
      groupBy: mockOffitelRentGroupBy,
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

// 파서 캐시가 DB(getRegionIndex)를 타지 않도록 region index를 모킹
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]),
  };
});

import {
  searchTransactions,
  getTransactionStats,
  getComplexList,
  searchAll,
  getAreaGroups,
} from '../../src/services/realEstateService.js';

// Sample sale transaction record
const sampleSaleRecord = {
  id: 1,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '11680',
  dongName: '역삼동',
  buildingName: '래미안',
  buildYear: 2008,
  floor: 12,
  exclusiveArea: 84.82,
  jibun: '123',
  roadName: null,
  lat: 37.5,
  lng: 127.0,
  dealYear: 2024,
  dealMonth: 1,
  dealDay: 15,
  dealAmount: BigInt(82500),
  dealType: null,
  sourceId: 'apt-sale-001',
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
};

// Sample rent transaction record
const sampleRentRecord = {
  id: 2,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '11680',
  dongName: '역삼동',
  buildingName: '래미안',
  buildYear: 2008,
  floor: 5,
  exclusiveArea: 59.5,
  jibun: '123',
  roadName: null,
  lat: 37.5,
  lng: 127.0,
  dealYear: 2024,
  dealMonth: 1,
  dealDay: 10,
  rentType: '전세',
  deposit: BigInt(50000),
  monthlyRent: null,
  contractTerm: 24,
  sourceId: 'apt-rent-001',
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// searchTransactions
// ─────────────────────────────────────────────
describe('searchTransactions', () => {
  it('maps apt-sale type to aptSaleTransaction model', async () => {
    mockAptSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockAptSaleCount.mockResolvedValue(1);

    const result = await searchTransactions('apt-sale', { page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
  });

  it('maps apt-rent type to aptRentTransaction model', async () => {
    mockAptRentFindMany.mockResolvedValue([sampleRentRecord]);
    mockAptRentCount.mockResolvedValue(1);

    const result = await searchTransactions('apt-rent', { page: 1, limit: 20 });

    expect(mockAptRentFindMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
  });

  it('maps villa-sale type to villaSaleTransaction model', async () => {
    mockVillaSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockVillaSaleCount.mockResolvedValue(1);

    await searchTransactions('villa-sale', { page: 1, limit: 20 });

    expect(mockVillaSaleFindMany).toHaveBeenCalledTimes(1);
  });

  it('maps villa-rent type to villaRentTransaction model', async () => {
    mockVillaRentFindMany.mockResolvedValue([sampleRentRecord]);
    mockVillaRentCount.mockResolvedValue(1);

    await searchTransactions('villa-rent', { page: 1, limit: 20 });

    expect(mockVillaRentFindMany).toHaveBeenCalledTimes(1);
  });

  it('maps offitel-sale type to offitelSaleTransaction model', async () => {
    mockOffitelSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockOffitelSaleCount.mockResolvedValue(1);

    await searchTransactions('offitel-sale', { page: 1, limit: 20 });

    expect(mockOffitelSaleFindMany).toHaveBeenCalledTimes(1);
  });

  it('maps offitel-rent type to offitelRentTransaction model', async () => {
    mockOffitelRentFindMany.mockResolvedValue([sampleRentRecord]);
    mockOffitelRentCount.mockResolvedValue(1);

    await searchTransactions('offitel-rent', { page: 1, limit: 20 });

    expect(mockOffitelRentFindMany).toHaveBeenCalledTimes(1);
  });

  it('throws for unknown type slug', async () => {
    await expect(
      searchTransactions('unknown-type', { page: 1, limit: 20 })
    ).rejects.toThrow();
  });

  it('returns correct pagination structure', async () => {
    mockAptSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockAptSaleCount.mockResolvedValue(45);

    const result = await searchTransactions('apt-sale', { page: 2, limit: 20 });

    expect(result.page).toBe(2);
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
  });

  it('calculates correct skip for page 2', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { page: 2, limit: 10 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it('filters by city when provided', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { city: '서울특별시', page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ city: '서울특별시' }),
      })
    );
  });

  it('filters by district when provided', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { district: '강남구', page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district: '강남구' }),
      })
    );
  });

  it('filters by bjdCode when provided', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { bjdCode: '11680', page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680' }),
      })
    );
  });

  it('filters by buildingName when provided', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { buildingName: '래미안', page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          buildingName: expect.objectContaining({ startsWith: '래미안' }),
        }),
      })
    );
  });

  it('filters by dealYear and dealMonth when provided', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { dealYear: 2024, dealMonth: 1, page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealYear: 2024, dealMonth: 1 }),
      })
    );
  });

  it('orders by dealYear desc, dealMonth desc, dealDay desc', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    await searchTransactions('apt-sale', { page: 1, limit: 20 });

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { dealYear: 'desc' },
          { dealMonth: 'desc' },
          { dealDay: 'desc' },
        ],
      })
    );
  });

  it('returns totalPages 1 when total equals limit', async () => {
    mockAptSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockAptSaleCount.mockResolvedValue(20);

    const result = await searchTransactions('apt-sale', { page: 1, limit: 20 });

    expect(result.totalPages).toBe(1);
  });

  it('returns totalPages 0 when total is 0', async () => {
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);

    const result = await searchTransactions('apt-sale', { page: 1, limit: 20 });

    expect(result.totalPages).toBe(0);
  });
});

// ─────────────────────────────────────────────
// getTransactionStats
// ─────────────────────────────────────────────
describe('getTransactionStats', () => {
  const saleGroupByResult = [
    {
      dealYear: 2024,
      dealMonth: 1,
      _avg: { dealAmount: 82500 },
      _max: { dealAmount: 120000 },
      _min: { dealAmount: 60000 },
      _count: { dealAmount: 5 },
    },
    {
      dealYear: 2023,
      dealMonth: 12,
      _avg: { dealAmount: 79000 },
      _max: { dealAmount: 110000 },
      _min: { dealAmount: 55000 },
      _count: { dealAmount: 3 },
    },
  ];

  const rentGroupByResult = [
    {
      dealYear: 2024,
      dealMonth: 1,
      _avg: { deposit: 50000 },
      _max: { deposit: 70000 },
      _min: { deposit: 35000 },
      _count: { deposit: 4 },
    },
  ];

  it('calls groupBy on aptSaleTransaction for apt-sale type', async () => {
    mockAptSaleGroupBy.mockResolvedValue(saleGroupByResult);

    await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('uses raw query for apt-rent type (환산보증금)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6);

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
  });

  it('calls groupBy on villaSaleTransaction for villa-sale type', async () => {
    mockVillaSaleGroupBy.mockResolvedValue(saleGroupByResult);

    await getTransactionStats('villa-sale', '11680', undefined, 6);

    expect(mockVillaSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('uses raw query for villa-rent type (환산보증금)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('villa-rent', '11680', undefined, 6);

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
  });

  it('calls groupBy on offitelSaleTransaction for offitel-sale type', async () => {
    mockOffitelSaleGroupBy.mockResolvedValue(saleGroupByResult);

    await getTransactionStats('offitel-sale', '11680', undefined, 6);

    expect(mockOffitelSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('uses raw query for offitel-rent type (환산보증금)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getTransactionStats('offitel-rent', '11680', undefined, 6);

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
  });

  it('returns StatsResponse with monthly array and summary', async () => {
    mockAptSaleGroupBy.mockResolvedValue(saleGroupByResult);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result).toHaveProperty('monthly');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.monthly)).toBe(true);
    expect(result.monthly[0]).toHaveProperty('year');
    expect(result.monthly[0]).toHaveProperty('month');
    expect(result.monthly[0]).toHaveProperty('avgPrice');
    expect(result.monthly[0]).toHaveProperty('maxPrice');
    expect(result.monthly[0]).toHaveProperty('minPrice');
    expect(result.monthly[0]).toHaveProperty('count');
  });

  it('returns monthly stats via raw query for rent type', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { dealYear: 2024, dealMonth: 1, avgPrice: 50000, maxPrice: 70000, minPrice: 35000, count: BigInt(4) },
    ]);

    const result = await getTransactionStats('apt-rent', '11680', undefined, 6);

    expect(Array.isArray(result.monthly)).toBe(true);
    expect(result.monthly[0]).toHaveProperty('avgPrice');
    expect(result.monthly[0]).toHaveProperty('count');
  });

  it('filters by rentType when provided', async () => {
    mockAptRentGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '전세');

    expect(mockAptRentGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rentType: '전세' }),
      })
    );
  });

  it('uses 환산보증금 raw query when rentType is 월세', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { dealYear: 2024, dealMonth: 1, avgPrice: 37000, maxPrice: 49000, minPrice: 25000, count: BigInt(3) },
    ]);

    const result = await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '월세');

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit + monthlyRent * 240');
    expect(result.monthly[0].avgPrice).toBe(37000);
  });

  it('uses deposit as priceField when rentType is 전세', async () => {
    mockAptRentGroupBy.mockResolvedValue(rentGroupByResult);

    await getTransactionStats('apt-rent', '11680', undefined, 6, undefined, '전세');

    expect(mockAptRentGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        _avg: expect.objectContaining({ deposit: true }),
      })
    );
  });

  it('groups by dealYear and dealMonth', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: expect.arrayContaining(['dealYear', 'dealMonth']),
      })
    );
  });

  it('filters by bjdCode', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680' }),
      })
    );
  });

  it('filters by buildingName when provided', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 6);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680', buildingName: '래미안' }),
      })
    );
  });

  it('throws for unknown type slug', async () => {
    await expect(
      getTransactionStats('unknown-type', '11680', undefined, 6)
    ).rejects.toThrow();
  });

  // ── 이동평균 / summary 계산 ──

  it('calculates changeRate correctly from 6 months of data', async () => {
    // previous3: months 10-12/2023, avgPrice=100 → previousAvg=100
    // recent3: months 1-3/2024, avgPrice=110 → recentAvg=110
    // changeRate = (110-100)/100 * 100 = 10
    const sixMonthData = [
      { dealYear: 2023, dealMonth: 10, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 2 } },
      { dealYear: 2023, dealMonth: 11, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 2 } },
      { dealYear: 2023, dealMonth: 12, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 2 } },
      { dealYear: 2024, dealMonth: 1,  _avg: { dealAmount: 110 }, _max: { dealAmount: 110 }, _min: { dealAmount: 110 }, _count: { dealAmount: 2 } },
      { dealYear: 2024, dealMonth: 2,  _avg: { dealAmount: 110 }, _max: { dealAmount: 110 }, _min: { dealAmount: 110 }, _count: { dealAmount: 2 } },
      { dealYear: 2024, dealMonth: 3,  _avg: { dealAmount: 110 }, _max: { dealAmount: 110 }, _min: { dealAmount: 110 }, _count: { dealAmount: 2 } },
    ];
    mockAptSaleGroupBy.mockResolvedValue(sixMonthData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result.summary.recentAvg).toBe(110);
    expect(result.summary.previousAvg).toBe(100);
    expect(result.summary.changeRate).toBeCloseTo(10, 5);
  });

  it('sets changeRate to null when no previous 3 months data', async () => {
    // Only 3 months → previous3 is empty → previousAvg=null → changeRate=null
    const threeMonthData = [
      { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 2 } },
      { dealYear: 2024, dealMonth: 2, _avg: { dealAmount: 110 }, _max: { dealAmount: 110 }, _min: { dealAmount: 110 }, _count: { dealAmount: 2 } },
      { dealYear: 2024, dealMonth: 3, _avg: { dealAmount: 120 }, _max: { dealAmount: 120 }, _min: { dealAmount: 120 }, _count: { dealAmount: 2 } },
    ];
    mockAptSaleGroupBy.mockResolvedValue(threeMonthData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result.summary.previousAvg).toBeNull();
    expect(result.summary.changeRate).toBeNull();
  });

  it('sets lowVolume=true when recent 3 months total count < 3', async () => {
    const lowData = [
      { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 1 } },
      { dealYear: 2024, dealMonth: 2, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 1 } },
    ];
    mockAptSaleGroupBy.mockResolvedValue(lowData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result.summary.lowVolume).toBe(true);
  });

  it('sets lowVolume=false when recent 3 months total count >= 3', async () => {
    const normalData = [
      { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 3 } },
    ];
    mockAptSaleGroupBy.mockResolvedValue(normalData);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result.summary.lowVolume).toBe(false);
  });

  it('returns correct totalCount as sum of all monthly counts', async () => {
    const data = [
      { dealYear: 2024, dealMonth: 1, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 4 } },
      { dealYear: 2024, dealMonth: 2, _avg: { dealAmount: 100 }, _max: { dealAmount: 100 }, _min: { dealAmount: 100 }, _count: { dealAmount: 6 } },
    ];
    mockAptSaleGroupBy.mockResolvedValue(data);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(result.summary.totalCount).toBe(10);
  });
});

// ─────────────────────────────────────────────
// getComplexList
// ─────────────────────────────────────────────
describe('getComplexList', () => {
  // Raw rows returned by $queryRawUnsafe (SELECT columns only — no id/type/updatedAt)
  const rawSummaryRows = [
    {
      buildingName: '래미안', bjdCode: '11680',
      city: '서울특별시', district: '강남구', dongName: '역삼동',
      transactionCount: 10, latestPrice: BigInt(150000),
      latestDealYear: 2024, latestDealMonth: 1,
      buildYear: 2008,
      lat: '37.5', lng: '127.0',
    },
    {
      buildingName: '아이파크', bjdCode: '11680',
      city: '서울특별시', district: '강남구', dongName: '역삼동',
      transactionCount: 5, latestPrice: BigInt(120000),
      latestDealYear: 2023, latestDealMonth: 12,
      buildYear: null,
      lat: '37.6', lng: '127.1',
    },
  ];

  beforeEach(() => {
    mockQueryRawUnsafe.mockReset();
  });

  // Helper: set up mockQueryRawUnsafe to return rows on first call and count on second
  function setupMocks(rows = rawSummaryRows, total = rows.length) {
    mockQueryRawUnsafe
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ total: BigInt(total) }]);
  }

  it('uses $queryRawUnsafe for both SELECT and COUNT queries', async () => {
    setupMocks();

    await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('SELECT query includes valid-name REGEXP filter', async () => {
    setupMocks();

    await getComplexList('apt-sale', '서울특별시', '강남구');

    const selectSql: string = mockQueryRawUnsafe.mock.calls[0][0];
    expect(selectSql).toContain('CHAR_LENGTH(buildingName) >= 2');
    expect(selectSql).toContain("NOT REGEXP '^[[:space:]]*[(][0-9]'");
    expect(selectSql).toContain("NOT REGEXP '^[0-9()[:space:]-]+$'");
  });

  it('COUNT query includes valid-name REGEXP filter', async () => {
    setupMocks();

    await getComplexList('apt-sale', '서울특별시', '강남구');

    const countSql: string = mockQueryRawUnsafe.mock.calls[1][0];
    expect(countSql).toContain('CHAR_LENGTH(buildingName) >= 2');
    expect(countSql).toContain("NOT REGEXP '^[[:space:]]*[(][0-9]'");
    expect(countSql).toContain("NOT REGEXP '^[0-9()[:space:]-]+$'");
  });

  it('passes type, city, district as parameterised values', async () => {
    setupMocks();

    await getComplexList('apt-sale', '서울특별시', '강남구');

    const selectParams = mockQueryRawUnsafe.mock.calls[0];
    // params after the SQL string: type, city, district, limit, offset
    expect(selectParams).toContain('apt-sale');
    expect(selectParams).toContain('서울특별시');
    expect(selectParams).toContain('강남구');
  });

  it('buildingName prefix filter passed via LIKE CONCAT param', async () => {
    setupMocks([], 0);

    await getComplexList('apt-sale', undefined, undefined, '래미안');

    const selectSql: string = mockQueryRawUnsafe.mock.calls[0][0];
    expect(selectSql).toContain("LIKE CONCAT(?, '%')");
    const selectParams = mockQueryRawUnsafe.mock.calls[0];
    expect(selectParams).toContain('래미안');
  });

  it('returns paginated result with items, total, page, totalPages', async () => {
    setupMocks();

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total', 2);
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('totalPages', 1);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0]).toHaveProperty('buildingName', '래미안');
    expect(result.items[0]).toHaveProperty('bjdCode', '11680');
    expect(result.items[0]).toHaveProperty('transactionCount', 10);
  });

  it('returns lat and lng converted to Number from summary', async () => {
    setupMocks();

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result.items[0]).toHaveProperty('lat', 37.5);
    expect(result.items[0]).toHaveProperty('lng', 127.0);
  });

  it('maps latestDealYear/Month → lastDealYear/Month and converts latestPrice to Number', async () => {
    setupMocks();

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result.items[0]).toHaveProperty('lastDealYear', 2024);
    expect(result.items[0]).toHaveProperty('lastDealMonth', 1);
    expect(result.items[0]).toHaveProperty('latestPrice', 150000);
  });

  it('handles null latestPrice/lat/lng gracefully', async () => {
    const nullRow = {
      buildingName: '한강뷰', bjdCode: '11680',
      city: '서울특별시', district: '강남구', dongName: '역삼동',
      transactionCount: 3, latestPrice: null,
      latestDealYear: null, latestDealMonth: null,
      buildYear: null,
      lat: null, lng: null,
    };
    mockQueryRawUnsafe
      .mockResolvedValueOnce([nullRow])
      .mockResolvedValueOnce([{ total: BigInt(1) }]);

    const result = await getComplexList('apt-sale');

    expect(result.items[0].latestPrice).toBeNull();
    expect(result.items[0].lat).toBeNull();
    expect(result.items[0].lng).toBeNull();
  });

  it('invalid 지번-style name "(12-3)" would be filtered at DB level — SQL contains the REGEXP', async () => {
    // The filtering happens in MySQL via REGEXP, so the mock returns only valid rows.
    // We verify the SQL contains the guard that would exclude e.g. "(12-3)", "123-4", "1".
    setupMocks([], 0);

    await getComplexList('apt-sale', '서울특별시', '강남구');

    const selectSql: string = mockQueryRawUnsafe.mock.calls[0][0];
    // First REGEXP catches names starting with optional spaces then '(' followed by digit
    expect(selectSql).toMatch(/NOT REGEXP.*\^\[\[:space:\]\]\*\[\(\]\[0-9\]/);
    // Second REGEXP catches names composed entirely of digits, parens, spaces, hyphens
    expect(selectSql).toMatch(/NOT REGEXP.*\^\[0-9\(\)\[:space:\]-\]\+\$/);
  });

  it('total=0 yields totalPages=0', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(0) }]);

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('page 2 passes correct LIMIT/OFFSET to raw query', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(30) }]);

    await getComplexList('apt-sale', '서울특별시', '강남구', undefined, 2, 15);

    const selectParams = mockQueryRawUnsafe.mock.calls[0];
    // Last two params are LIMIT and OFFSET
    const paramsArr = selectParams.slice(1); // remove SQL string
    expect(paramsArr[paramsArr.length - 1]).toBe(15);  // OFFSET = (2-1)*15
    expect(paramsArr[paramsArr.length - 2]).toBe(15);  // LIMIT
  });

  it('throws for unknown type slug', async () => {
    await expect(
      getComplexList('unknown-type', '서울특별시', '강남구')
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────
// searchAll
// ─────────────────────────────────────────────
describe('searchAll', () => {
  const sampleGroupBySale = {
    buildingName: '래미안',
    bjdCode: '11680',
    city: '서울특별시',
    district: '강남구',
    dongName: '역삼동',
    buildYear: 2008,
    _count: { id: 3 },
    _max: { dealYear: 2024, dealMonth: 1, dealAmount: BigInt(82500) },
  };
  const sampleGroupByRent = {
    buildingName: '래미안',
    bjdCode: '11680',
    city: '서울특별시',
    district: '강남구',
    dongName: '역삼동',
    buildYear: 2008,
    _count: { id: 2 },
    _max: { dealYear: 2024, dealMonth: 3, deposit: BigInt(30000) },
  };

  beforeEach(() => {
    mockAptSaleGroupBy.mockResolvedValue([]);
    mockAptRentGroupBy.mockResolvedValue([]);
    mockVillaSaleGroupBy.mockResolvedValue([]);
    mockVillaRentGroupBy.mockResolvedValue([]);
    mockOffitelSaleGroupBy.mockResolvedValue([]);
    mockOffitelRentGroupBy.mockResolvedValue([]);
    mockSummaryCount.mockResolvedValue(0);
  });

  it('calls groupBy on all 6 models in parallel', async () => {
    await searchAll('래미안');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockAptRentGroupBy).toHaveBeenCalledTimes(1);
    expect(mockVillaSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockVillaRentGroupBy).toHaveBeenCalledTimes(1);
    expect(mockOffitelSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockOffitelRentGroupBy).toHaveBeenCalledTimes(1);
  });

  it('searches buildingName with startsWith for each model', async () => {
    await searchAll('래미안');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          buildingName: expect.objectContaining({ startsWith: '래미안' }),
        }),
      })
    );
  });

  it('returns categories array with type, count, items for each model', async () => {
    mockAptSaleGroupBy.mockResolvedValue([sampleGroupBySale]);
    mockSummaryCount.mockResolvedValue(3);

    const result = await searchAll('래미안');

    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
    const aptSale = result.categories.find((c) => c.type === 'apt-sale');
    expect(aptSale).toBeDefined();
    expect(aptSale!.count).toBe(3);
    expect(aptSale!.items).toHaveLength(1);
  });

  it('limits preview items to 3 per category', async () => {
    const manyGroups = [sampleGroupBySale, { ...sampleGroupBySale, bjdCode: '11681' }, { ...sampleGroupBySale, bjdCode: '11682' }];
    mockAptSaleGroupBy.mockResolvedValue(manyGroups);
    mockAptSaleCount.mockResolvedValue(10);

    const result = await searchAll('래미안');

    const aptSale = result.categories.find((c) => c.type === 'apt-sale');
    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    );
    expect(aptSale!.items).toHaveLength(3);
  });

  it('returns all 6 categories in result', async () => {
    const result = await searchAll('테스트');

    expect(result.categories).toHaveLength(6);
    const types = result.categories.map((c) => c.type);
    expect(types).toContain('apt-sale');
    expect(types).toContain('apt-rent');
    expect(types).toContain('villa-sale');
    expect(types).toContain('villa-rent');
    expect(types).toContain('offitel-sale');
    expect(types).toContain('offitel-rent');
  });

  it('filters by city when provided', async () => {
    await searchAll('래미안', '서울특별시');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: expect.objectContaining({ in: expect.arrayContaining(['서울특별시', '서울']) }),
        }),
      })
    );
  });

  it('filters by district when provided', async () => {
    await searchAll('래미안', undefined, '강남구');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district: '강남구' }),
      })
    );
  });

  it('runs all 6 model groupBy+count queries in parallel (Promise.all)', async () => {
    const callOrder: string[] = [];
    mockAptSaleGroupBy.mockImplementation(async () => { callOrder.push('apt-sale-groupBy'); return []; });
    mockAptSaleCount.mockImplementation(async () => { callOrder.push('apt-sale-count'); return 0; });
    mockAptRentGroupBy.mockImplementation(async () => { callOrder.push('apt-rent-groupBy'); return []; });
    mockAptRentCount.mockImplementation(async () => { callOrder.push('apt-rent-count'); return 0; });
    mockVillaSaleGroupBy.mockImplementation(async () => { callOrder.push('villa-sale-groupBy'); return []; });
    mockVillaSaleCount.mockImplementation(async () => { callOrder.push('villa-sale-count'); return 0; });
    mockVillaRentGroupBy.mockImplementation(async () => { callOrder.push('villa-rent-groupBy'); return []; });
    mockVillaRentCount.mockImplementation(async () => { callOrder.push('villa-rent-count'); return 0; });
    mockOffitelSaleGroupBy.mockImplementation(async () => { callOrder.push('offitel-sale-groupBy'); return []; });
    mockOffitelSaleCount.mockImplementation(async () => { callOrder.push('offitel-sale-count'); return 0; });
    mockOffitelRentGroupBy.mockImplementation(async () => { callOrder.push('offitel-rent-groupBy'); return []; });
    mockOffitelRentCount.mockImplementation(async () => { callOrder.push('offitel-rent-count'); return 0; });

    await searchAll('래미안');

    expect(callOrder.filter((c) => c.endsWith('-groupBy'))).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────
// getTransactionStats - exclusiveArea 필터 (TEST-1)
// ─────────────────────────────────────────────
describe('getTransactionStats - exclusiveArea 필터', () => {
  it('exclusiveArea=84 전달 시 where에 ±2㎡ 범위 필터가 적용되어야 한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 6, 84);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exclusiveArea: { gte: 82, lte: 86 },
        }),
      })
    );
  });

  it('exclusiveArea=59 전달 시 where에 { gte: 57, lte: 61 } 범위가 적용되어야 한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 6, 59);

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          exclusiveArea: { gte: 57, lte: 61 },
        }),
      })
    );
  });

  it('exclusiveArea 미전달 시 where에 exclusiveArea 필드가 없어야 한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 6);

    const callArg = mockAptSaleGroupBy.mock.calls[0][0];
    expect(callArg.where).not.toHaveProperty('exclusiveArea');
  });

  it('84㎡ 필터는 59㎡ 거래를 포함하지 않는 범위여야 한다 (gte 82 > 59)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getTransactionStats('apt-sale', '11680', '래미안', 6, 84);

    const callArg = mockAptSaleGroupBy.mock.calls[0][0];
    const { gte } = callArg.where.exclusiveArea;
    expect(gte).toBeGreaterThan(59);
  });
});

// ─────────────────────────────────────────────
// getAreaGroups (TEST-4)
// ─────────────────────────────────────────────
describe('getAreaGroups', () => {
  it('calls groupBy on aptSaleTransaction by exclusiveArea', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['exclusiveArea'] })
    );
  });

  it('59.5㎡와 58.8㎡은 ±2㎡ 이내이므로 같은 그룹으로 병합된다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.5, _count: { exclusiveArea: 3 } },
      { exclusiveArea: 58.8, _count: { exclusiveArea: 2 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(5);
  });

  it('59㎡와 84㎡는 ±2㎡를 초과하므로 별도 그룹으로 분리된다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.5, _count: { exclusiveArea: 4 } },
      { exclusiveArea: 84.82, _count: { exclusiveArea: 6 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result).toHaveLength(2);
    const areas = result.map((g) => g.area);
    expect(areas).toContain(Math.round(59.5));
    expect(areas).toContain(Math.round(84.82));
  });

  it('pyeong은 Math.round(area / 3.305)로 환산되어야 한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 84.82, _count: { exclusiveArea: 5 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0].pyeong).toBe(Math.round(85 / 3.305));
  });

  it('결과는 면적 오름차순으로 정렬되어야 한다 (작은 평수부터)', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 84.82, _count: { exclusiveArea: 10 } },
      { exclusiveArea: 59.5, _count: { exclusiveArea: 3 } },
      { exclusiveArea: 114.9, _count: { exclusiveArea: 7 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0].area).toBe(60);  // 59.5 → 60
    expect(result[1].area).toBe(85);  // 84.82 → 85
    expect(result[2].area).toBe(115); // 114.9 → 115
  });

  it('buildingName 전달 시 where에 buildingName이 포함된다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getAreaGroups('apt-sale', '11680', '래미안');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bjdCode: '11680', buildingName: '래미안' }),
      })
    );
  });

  it('각 그룹은 area, pyeong, count 필드를 가져야 한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([
      { exclusiveArea: 59.5, _count: { exclusiveArea: 3 } },
    ]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result[0]).toHaveProperty('area');
    expect(result[0]).toHaveProperty('pyeong');
    expect(result[0]).toHaveProperty('count');
  });

  it('빈 결과 시 빈 배열을 반환한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    const result = await getAreaGroups('apt-sale', '11680');

    expect(result).toEqual([]);
  });
});
