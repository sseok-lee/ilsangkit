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
  const prismaClient = {
    toilet: model,
    wifi: model,
    clothes: model,
    parking: model,
    aed: model,
    library: model,
    hospital: model,
    pharmacy: model,
    park: model,
    school: model,
    market: model,
    childcare: model,
    evCharger: model,
    sports: model,
    wasteSchedule: model,
    region: { findFirst: mockFindFirst },
  };
  return {
    default: prismaClient,
    prisma: prismaClient,
  };
});

import { search, getDetail, getAllIds, getByRegion, CATEGORY_REGISTRY, flushViewCounts } from '../../src/services/facilityService.js';

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

beforeEach(async () => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  // 이전 테스트에서 남은 viewCount 버퍼 비우기
  await flushViewCounts();
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});

describe('CATEGORY_REGISTRY', () => {
  it('should NOT contain kiosk key', () => {
    expect(CATEGORY_REGISTRY).not.toHaveProperty('kiosk');
    expect(Object.keys(CATEGORY_REGISTRY)).not.toContain('kiosk');
  });

  it('should return null for kiosk category search', async () => {
    const result = await getDetail('kiosk', 'test-1');
    expect(result).toBeNull();
  });

  it('should contain park key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('park');
  });

  it('should have park listFields defined', () => {
    expect(CATEGORY_REGISTRY.park.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.park.listFields)).toBe(true);
  });

  it('should have park detailFields defined', () => {
    expect(CATEGORY_REGISTRY.park.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.park.detailFields)).toBe(true);
  });

  it('should contain school key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('school');
  });

  it('should have school listFields defined', () => {
    expect(CATEGORY_REGISTRY.school.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.school.listFields)).toBe(true);
  });

  it('should have school detailFields defined', () => {
    expect(CATEGORY_REGISTRY.school.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.school.detailFields)).toBe(true);
  });

  it('should contain market key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('market');
  });

  it('should have market listFields defined', () => {
    expect(CATEGORY_REGISTRY.market.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.market.listFields)).toBe(true);
  });

  it('should have market detailFields defined', () => {
    expect(CATEGORY_REGISTRY.market.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.market.detailFields)).toBe(true);
  });

  it('should contain childcare key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('childcare');
  });

  it('should have childcare listFields defined', () => {
    expect(CATEGORY_REGISTRY.childcare.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.childcare.listFields)).toBe(true);
  });

  it('should have childcare detailFields defined', () => {
    expect(CATEGORY_REGISTRY.childcare.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.childcare.detailFields)).toBe(true);
  });

  it('should contain ev-charger key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('ev-charger');
  });

  it('should have ev-charger listFields defined', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY['ev-charger'].listFields)).toBe(true);
  });

  it('should have ev-charger detailFields defined', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY['ev-charger'].detailFields)).toBe(true);
  });

  it('should have ev-charger listFields including chgerType and output', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toContain('chgerType');
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toContain('output');
  });

  it('should have ev-charger detailFields including all key fields', () => {
    const detailFields = CATEGORY_REGISTRY['ev-charger'].detailFields;
    expect(detailFields).toContain('statId');
    expect(detailFields).toContain('chgerId');
    expect(detailFields).toContain('busiNm');
    expect(detailFields).toContain('output');
    expect(detailFields).toContain('maker');
  });

  it('should contain sports key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('sports');
  });

  it('should have sports listFields defined', () => {
    expect(CATEGORY_REGISTRY.sports.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.sports.listFields)).toBe(true);
  });

  it('should have sports detailFields defined', () => {
    expect(CATEGORY_REGISTRY.sports.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.sports.detailFields)).toBe(true);
  });

  it('should have sports listFields including ftypeNm and fcobNm', () => {
    expect(CATEGORY_REGISTRY.sports.listFields).toContain('ftypeNm');
    expect(CATEGORY_REGISTRY.sports.listFields).toContain('fcobNm');
  });

  it('should have sports detailFields including all key fields', () => {
    const detailFields = CATEGORY_REGISTRY.sports.detailFields;
    expect(detailFields).toContain('faciGbNm');
    expect(detailFields).toContain('fcobNm');
    expect(detailFields).toContain('ftypeNm');
    expect(detailFields).toContain('faciHomepage');
    expect(detailFields).toContain('standCptPsnCnt');
  });
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

    expect(result.total).toBeGreaterThan(0);
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
            { roadAddress: { contains: '강남' } },
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
          city: { in: expect.arrayContaining(['서울특별시', '서울']) },
          district: '강남구',
        }),
      })
    );
  });

  it('searches hospital category', async () => {
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'hospital', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('hospital');
  });

  it('searches pharmacy category', async () => {
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'pharmacy', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('pharmacy');
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

  it('increments viewCount via batch flush', async () => {
    mockFindUnique.mockResolvedValue(sampleRecord);

    await getDetail('toilet', 'test-1');

    // viewCount는 버퍼에 누적 → flush 시 일괄 반영
    expect(mockUpdate).not.toHaveBeenCalled();
    await flushViewCounts();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'test-1' },
      data: { viewCount: { increment: 1 } },
    });
  });

  it('returns hospital details with detailFields', async () => {
    const hospitalRecord = {
      ...sampleRecord,
      phone: '02-1234-5678',
      clCdNm: '의원',
      drTotCnt: 5,
      homepage: 'https://example.com',
      estbDd: '2020-01-01',
    };
    mockFindUnique.mockResolvedValue(hospitalRecord);

    const result = await getDetail('hospital', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.category).toBe('hospital');
    expect(result!.details).toHaveProperty('phone', '02-1234-5678');
    expect(result!.details).toHaveProperty('clCdNm', '의원');
    expect(result!.details).toHaveProperty('drTotCnt', 5);
  });

  it('returns pharmacy details with detailFields', async () => {
    const pharmacyRecord = {
      ...sampleRecord,
      phone: '02-9876-5432',
      dutyTime1s: '0900',
      dutyTime1c: '1800',
      hpid: 'PHARM-001',
    };
    mockFindUnique.mockResolvedValue(pharmacyRecord);

    const result = await getDetail('pharmacy', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.category).toBe('pharmacy');
    expect(result!.details).toHaveProperty('phone', '02-9876-5432');
    expect(result!.details).toHaveProperty('dutyTime1s', '0900');
    expect(result!.details).toHaveProperty('dutyTime1c', '1800');
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
