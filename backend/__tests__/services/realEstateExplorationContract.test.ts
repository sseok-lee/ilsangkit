import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRawUnsafe, mockGetLatestDeals } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockGetLatestDeals: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () =>
      actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]),
  };
});

vi.mock('../../src/services/realEstateLatestDeals.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/realEstateLatestDeals.js');
  return {
    ...actual,
    getLatestDeals: mockGetLatestDeals,
  };
});

import { getComplexList, searchPropertyComplexesByKeyword } from '../../src/services/realEstateService.js';
import { latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import type { BuildingKey, LatestDeals } from '../../src/types/realEstateExploration.js';

const saleBundle: LatestDeals = {
  sale: {
    kind: 'sale',
    amount: 150000,
    deposit: null,
    monthlyRent: null,
    exclusiveArea: 84.9,
    floor: 12,
    dealYear: 2026,
    dealMonth: 5,
    dealDay: 20,
  },
  jeonse: null,
  wolse: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRawUnsafe.mockImplementation((sql: string) => {
    if (String(sql).includes('COUNT(')) return Promise.resolve([{ total: 30n }]);
    return Promise.resolve([{
      type: 'apt-sale',
      buildingName: '래미안강남',
      bjdCode: '11680',
      city: '서울',
      district: '강남구',
      dongName: '역삼동',
      transactionCount: 12,
      latestPrice: 150000n,
      latestDealYear: 2026,
      latestDealMonth: 5,
      buildYear: 2010,
      lat: '37.5',
      lng: '127.0',
    }]);
  });
  mockGetLatestDeals.mockImplementation((keys: BuildingKey[]) =>
    Promise.resolve(new Map(keys.map((key) => [latestDealsKey(key), saleBundle]))),
  );
});

describe('real estate exploration list contracts', () => {
  it('preserves list pagination and flat fields while adding latestDeals', async () => {
    const response = await getComplexList('apt-sale', '서울특별시', '강남구', undefined, 1, 15);

    expect(response).toMatchObject({ total: 30, page: 1, totalPages: 2 });
    expect(response.items[0]).toHaveProperty('latestPrice');
    expect(response.items[0]).toHaveProperty('latestDeals.sale.exclusiveArea');
    expect(response.items[0].latestDeals.jeonse).toBeNull();
    expect(mockGetLatestDeals).toHaveBeenCalledWith([
      { propertyType: 'apt', buildingName: '래미안강남', bjdCode: '11680', dongName: '역삼동', jibun: null },
    ], 'sale');
  });

  it('uses all scope for property-level exploration lists', async () => {
    await searchPropertyComplexesByKeyword('apt', '강남', 1, 20);

    expect(mockGetLatestDeals).toHaveBeenCalledWith([
      { propertyType: 'apt', buildingName: '래미안강남', bjdCode: '11680', dongName: '역삼동', jibun: null },
    ], 'all');
  });
});
