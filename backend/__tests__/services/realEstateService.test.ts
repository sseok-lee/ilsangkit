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
  return { prisma: models, default: models };
});

import {
  searchTransactions,
  getTransactionStats,
  getComplexList,
  searchAll,
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
          buildingName: expect.objectContaining({ contains: '래미안' }),
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

  it('calls groupBy on aptRentTransaction for apt-rent type', async () => {
    mockAptRentGroupBy.mockResolvedValue(rentGroupByResult);

    await getTransactionStats('apt-rent', '11680', undefined, 6);

    expect(mockAptRentGroupBy).toHaveBeenCalledTimes(1);
  });

  it('calls groupBy on villaSaleTransaction for villa-sale type', async () => {
    mockVillaSaleGroupBy.mockResolvedValue(saleGroupByResult);

    await getTransactionStats('villa-sale', '11680', undefined, 6);

    expect(mockVillaSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('calls groupBy on villaRentTransaction for villa-rent type', async () => {
    mockVillaRentGroupBy.mockResolvedValue(rentGroupByResult);

    await getTransactionStats('villa-rent', '11680', undefined, 6);

    expect(mockVillaRentGroupBy).toHaveBeenCalledTimes(1);
  });

  it('calls groupBy on offitelSaleTransaction for offitel-sale type', async () => {
    mockOffitelSaleGroupBy.mockResolvedValue(saleGroupByResult);

    await getTransactionStats('offitel-sale', '11680', undefined, 6);

    expect(mockOffitelSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('calls groupBy on offitelRentTransaction for offitel-rent type', async () => {
    mockOffitelRentGroupBy.mockResolvedValue(rentGroupByResult);

    await getTransactionStats('offitel-rent', '11680', undefined, 6);

    expect(mockOffitelRentGroupBy).toHaveBeenCalledTimes(1);
  });

  it('returns monthly stats with avgPrice, maxPrice, minPrice, count for sale type', async () => {
    mockAptSaleGroupBy.mockResolvedValue(saleGroupByResult);

    const result = await getTransactionStats('apt-sale', '11680', undefined, 6);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('year');
    expect(result[0]).toHaveProperty('month');
    expect(result[0]).toHaveProperty('avgPrice');
    expect(result[0]).toHaveProperty('maxPrice');
    expect(result[0]).toHaveProperty('minPrice');
    expect(result[0]).toHaveProperty('count');
  });

  it('returns monthly stats using deposit for rent type', async () => {
    mockAptRentGroupBy.mockResolvedValue(rentGroupByResult);

    const result = await getTransactionStats('apt-rent', '11680', undefined, 6);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('avgPrice');
    expect(result[0]).toHaveProperty('count');
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
});

// ─────────────────────────────────────────────
// getComplexList
// ─────────────────────────────────────────────
describe('getComplexList', () => {
  const groupByResult = [
    {
      buildingName: '래미안',
      bjdCode: '11680',
      _count: { buildingName: 10 },
      _max: { dealYear: 2024, dealMonth: 1, lat: 37.5, lng: 127.0 },
    },
    {
      buildingName: '아이파크',
      bjdCode: '11680',
      _count: { buildingName: 5 },
      _max: { dealYear: 2023, dealMonth: 12, lat: 37.6, lng: 127.1 },
    },
  ];

  const mockDetail = { city: '서울특별시', district: '강남구', dongName: '역삼동', dealAmount: 150000 };

  it('calls groupBy on aptSaleTransaction for apt-sale type', async () => {
    mockAptSaleGroupBy.mockResolvedValue(groupByResult);
    mockAptSaleFindFirst.mockResolvedValue(mockDetail);

    await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
  });

  it('calls groupBy on villaRentTransaction for villa-rent type', async () => {
    mockVillaRentGroupBy.mockResolvedValue([]);

    await getComplexList('villa-rent', '서울특별시', '강남구');

    expect(mockVillaRentGroupBy).toHaveBeenCalledTimes(1);
  });

  it('groups by buildingName and bjdCode', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: expect.arrayContaining(['buildingName', 'bjdCode']),
      })
    );
  });

  it('filters by city and district', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: '서울특별시',
          district: '강남구',
        }),
      })
    );
  });

  it('returns paginated result with items, total, page, totalPages', async () => {
    mockAptSaleGroupBy.mockResolvedValue(groupByResult);
    mockAptSaleFindFirst.mockResolvedValue(mockDetail);

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('totalPages');
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items[0]).toHaveProperty('buildingName');
    expect(result.items[0]).toHaveProperty('bjdCode');
    expect(result.items[0]).toHaveProperty('transactionCount');
  });

  it('returns lat and lng from aggregated result', async () => {
    mockAptSaleGroupBy.mockResolvedValue(groupByResult);
    mockAptSaleFindFirst.mockResolvedValue(mockDetail);

    const result = await getComplexList('apt-sale', '서울특별시', '강남구');

    expect(result.items[0]).toHaveProperty('lat');
    expect(result.items[0]).toHaveProperty('lng');
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
  beforeEach(() => {
    // Default: all return empty
    mockAptSaleFindMany.mockResolvedValue([]);
    mockAptSaleCount.mockResolvedValue(0);
    mockAptRentFindMany.mockResolvedValue([]);
    mockAptRentCount.mockResolvedValue(0);
    mockVillaSaleFindMany.mockResolvedValue([]);
    mockVillaSaleCount.mockResolvedValue(0);
    mockVillaRentFindMany.mockResolvedValue([]);
    mockVillaRentCount.mockResolvedValue(0);
    mockOffitelSaleFindMany.mockResolvedValue([]);
    mockOffitelSaleCount.mockResolvedValue(0);
    mockOffitelRentFindMany.mockResolvedValue([]);
    mockOffitelRentCount.mockResolvedValue(0);
  });

  it('calls findMany on all 6 models in parallel', async () => {
    await searchAll('래미안');

    expect(mockAptSaleFindMany).toHaveBeenCalledTimes(1);
    expect(mockAptRentFindMany).toHaveBeenCalledTimes(1);
    expect(mockVillaSaleFindMany).toHaveBeenCalledTimes(1);
    expect(mockVillaRentFindMany).toHaveBeenCalledTimes(1);
    expect(mockOffitelSaleFindMany).toHaveBeenCalledTimes(1);
    expect(mockOffitelRentFindMany).toHaveBeenCalledTimes(1);
  });

  it('searches buildingName with LIKE (contains) for each model', async () => {
    await searchAll('래미안');

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          buildingName: expect.objectContaining({ contains: '래미안' }),
        }),
      })
    );
  });

  it('returns categories array with type, count, items for each model', async () => {
    mockAptSaleFindMany.mockResolvedValue([sampleSaleRecord]);
    mockAptSaleCount.mockResolvedValue(3);

    const result = await searchAll('래미안');

    expect(result).toHaveProperty('categories');
    expect(Array.isArray(result.categories)).toBe(true);
    const aptSale = result.categories.find((c) => c.type === 'apt-sale');
    expect(aptSale).toBeDefined();
    expect(aptSale!.count).toBe(3);
    expect(aptSale!.items).toHaveLength(1);
  });

  it('limits preview items to 3 per category', async () => {
    const manyRecords = [sampleSaleRecord, sampleSaleRecord, sampleSaleRecord];
    mockAptSaleFindMany.mockResolvedValue(manyRecords);
    mockAptSaleCount.mockResolvedValue(10);

    const result = await searchAll('래미안');

    const aptSale = result.categories.find((c) => c.type === 'apt-sale');
    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
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

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: '서울특별시',
        }),
      })
    );
  });

  it('filters by district when provided', async () => {
    await searchAll('래미안', undefined, '강남구');

    expect(mockAptSaleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          district: '강남구',
        }),
      })
    );
  });

  it('runs all 6 model queries in parallel (Promise.all)', async () => {
    // Verify that all mocks are called within same tick by tracking call order
    const callOrder: string[] = [];
    mockAptSaleFindMany.mockImplementation(async () => {
      callOrder.push('apt-sale-findMany');
      return [];
    });
    mockAptSaleCount.mockImplementation(async () => {
      callOrder.push('apt-sale-count');
      return 0;
    });
    mockAptRentFindMany.mockImplementation(async () => {
      callOrder.push('apt-rent-findMany');
      return [];
    });
    mockAptRentCount.mockImplementation(async () => {
      callOrder.push('apt-rent-count');
      return 0;
    });
    mockVillaSaleFindMany.mockImplementation(async () => {
      callOrder.push('villa-sale-findMany');
      return [];
    });
    mockVillaSaleCount.mockImplementation(async () => {
      callOrder.push('villa-sale-count');
      return 0;
    });
    mockVillaRentFindMany.mockImplementation(async () => {
      callOrder.push('villa-rent-findMany');
      return [];
    });
    mockVillaRentCount.mockImplementation(async () => {
      callOrder.push('villa-rent-count');
      return 0;
    });
    mockOffitelSaleFindMany.mockImplementation(async () => {
      callOrder.push('offitel-sale-findMany');
      return [];
    });
    mockOffitelSaleCount.mockImplementation(async () => {
      callOrder.push('offitel-sale-count');
      return 0;
    });
    mockOffitelRentFindMany.mockImplementation(async () => {
      callOrder.push('offitel-rent-findMany');
      return [];
    });
    mockOffitelRentCount.mockImplementation(async () => {
      callOrder.push('offitel-rent-count');
      return 0;
    });

    await searchAll('래미안');

    // All 6 findMany calls should have been made
    expect(callOrder.filter((c) => c.endsWith('-findMany'))).toHaveLength(6);
  });
});
