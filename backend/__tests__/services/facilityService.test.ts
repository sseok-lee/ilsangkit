import { describe, it, expect, vi, beforeEach } from 'vitest';

// These must be declared with vi.hoisted so they're available inside vi.mock factory
const { mockFindMany, mockCount, mockFindUnique, mockUpdate, mockFindFirst } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockFindFirst: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = {
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
  };
  return {
    default: {
      toilet: model,
      wifi: model,
      clothes: model,
      kiosk: model,
      parking: model,
      aed: model,
      library: model,
      region: { findFirst: mockFindFirst },
    },
  };
});

import { search, getDetail, getAllIds, getByRegion } from '../../src/services/facilityService.js';

const sampleRecord = {
  id: 'test-1',
  name: 'Test Facility',
  address: '서울시 강남구',
  roadAddress: '서울시 강남구 테헤란로',
  lat: 37.5,
  lng: 127.0,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '1168000000',
  sourceId: 'src-1',
  sourceUrl: null,
  viewCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
  operatingHours: '24시간',
  maleToilets: 3,
  maleUrinals: 5,
  femaleToilets: 4,
  hasDisabledToilet: true,
  openTime: '00:00',
  managingOrg: '강남구청',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

describe('search', () => {
  it('searches single category with DB pagination', async () => {
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'toilet', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('toilet');
    expect(result.items[0].id).toBe('test-1');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });

  it('searches all categories and aggregates counts', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([sampleRecord]);

    const result = await search({ page: 1, limit: 20 });

    expect(result.total).toBe(7);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('searches with keyword filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await search({ category: 'toilet', keyword: '강남', page: 1, limit: 20 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: '강남' } },
            { address: { contains: '강남' } },
          ],
        }),
      })
    );
  });

  it('searches with city/district filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await search({ category: 'wifi', city: '서울특별시', district: '강남구', page: 1, limit: 20 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: '서울특별시',
          district: '강남구',
        }),
      })
    );
  });
});

describe('getDetail', () => {
  it('returns facility details', async () => {
    mockFindUnique.mockResolvedValue(sampleRecord);

    const result = await getDetail('toilet', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-1');
    expect(result!.category).toBe('toilet');
    expect(result!.details).toHaveProperty('operatingHours');
    expect(result!.details).toHaveProperty('maleToilets');
  });

  it('returns null for non-existent ID', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getDetail('toilet', 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for invalid category', async () => {
    const result = await getDetail('invalid', 'test-1');
    expect(result).toBeNull();
  });

  it('increments viewCount asynchronously', async () => {
    mockFindUnique.mockResolvedValue(sampleRecord);

    await getDetail('toilet', 'test-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'test-1' },
      data: { viewCount: { increment: 1 } },
    });
  });
});

describe('getAllIds', () => {
  it('returns id and updatedAt for a category', async () => {
    const ids = [
      { id: '1', updatedAt: new Date() },
      { id: '2', updatedAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(ids);

    const result = await getAllIds('toilet');

    expect(result).toEqual(ids);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { id: true, updatedAt: true },
    });
  });
});

describe('getByRegion', () => {
  it('returns paginated results for a region', async () => {
    mockFindFirst.mockResolvedValue({
      city: '서울특별시',
      district: '강남구',
      bjdCode: '1168000000',
    });
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await getByRegion('서울특별시', '강남구', 'toilet', { page: 1, limit: 20 });

    expect(result.region.city).toBe('서울특별시');
    expect(result.region.district).toBe('강남구');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('returns empty items for invalid category', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await getByRegion('서울특별시', '강남구', 'invalid');

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
