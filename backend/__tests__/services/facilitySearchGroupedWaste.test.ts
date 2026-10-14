import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma mock — 모든 모델에 count/findMany를 제공
const { mockCount, mockFindMany, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

const { mockFtIds, mockFtCount } = vi.hoisted(() => ({
  mockFtIds: vi.fn(), mockFtCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { findMany: mockFindMany, count: mockCount, findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) };
  const prismaClient = {
    toilet: model, wifi: model, clothes: model, parking: model, aed: model,
    library: model, hospital: model, pharmacy: model, park: model, school: model,
    market: model, childcare: model, evCharger: model, sports: model, subway: model,
    wasteSchedule: model,
    region: { findFirst: vi.fn() },
    // ev-charger uses $queryRawUnsafe for GROUP BY statId
    $queryRawUnsafe: mockQueryRawUnsafe,
  };
  return { default: prismaClient, prisma: prismaClient };
});

// 파서 캐시가 DB(getRegionIndex)를 타지 않도록 region index를 모킹
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]),
  };
});

vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return { ...actual, fulltextIds: mockFtIds, fulltextCount: mockFtCount };
});

const { mockListWasteAreas, mockGetWasteDistrictDisplay, mockGetByRegion } = vi.hoisted(() => ({
  mockListWasteAreas: vi.fn(),
  mockGetWasteDistrictDisplay: vi.fn(),
  mockGetByRegion: vi.fn(),
}));

vi.mock('../../src/services/wasteAreaService.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/wasteAreaService.js');
  return {
    ...actual,
    isWasteAreaDiscoveryEnabled: () => true,
    listWasteAreas: mockListWasteAreas,
    getWasteDistrictDisplay: mockGetWasteDistrictDisplay,
  };
});

vi.mock('../../src/services/wasteScheduleService.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/wasteScheduleService.js');
  return { ...actual, getByRegion: mockGetByRegion };
});

import { ServiceUnavailableError } from '../../src/lib/errors.js';
import { searchGrouped } from '../../src/services/facilityService.js';

const sourceItem = { id: 501, city: '경기도', district: '의왕시', targetRegion: '내손동 일대', emissionPlace: '집 앞' };

describe('searchGrouped — 쓰레기 mode 정합', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
    mockQueryRawUnsafe.mockResolvedValue([{ cnt: 0n }]);
    mockFtIds.mockResolvedValue([]);
    mockFtCount.mockResolvedValue(0);
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [] });
  });

  it('구·군 지정 + source 모드면 원본 건수(unit 건)로 trash 그룹을 만든다', async () => {
    mockGetWasteDistrictDisplay.mockResolvedValue({ mode: 'source', count: 339 });
    mockGetByRegion.mockResolvedValue({ items: [sourceItem], total: 339, page: 1, totalPages: 17 });
    const result = await searchGrouped({ keyword: '쓰레기', city: '경기도', district: '의왕시' } as any);
    const trash = result.categories.find((c) => c.category === 'trash');
    expect(trash).toMatchObject({ count: 339, unit: '건' });
    expect(trash?.items[0]).toMatchObject({ id: '501', category: 'trash' });
    expect(mockListWasteAreas).not.toHaveBeenCalled();
  });

  it('source 모드 원본 0건이면 trash 그룹을 넣지 않는다', async () => {
    mockGetWasteDistrictDisplay.mockResolvedValue({ mode: 'source', count: 339 });
    mockGetByRegion.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    const result = await searchGrouped({ keyword: '없는곳', city: '경기도', district: '의왕시' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toBeUndefined();
  });

  it('areas 모드면 기존처럼 동 목록 그룹(unit 지역)', async () => {
    mockGetWasteDistrictDisplay.mockResolvedValue({ mode: 'areas', count: 22 });
    mockListWasteAreas.mockResolvedValue({
      items: [{ areaId: 101, name: '역삼1동', city: '서울특별시', district: '강남구', href: '/trash/areas/101', matchReason: 'region', scheduleCount: 1, conditionalCount: 0, summary: '', dataDate: null }],
      total: 22, page: 1, totalPages: 8, unresolved: [],
    });
    const result = await searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toMatchObject({ count: 22, unit: '지역' });
    expect(mockGetByRegion).not.toHaveBeenCalled();
  });

  it('활성 세대가 없어 ServiceUnavailableError 가 나면 trash 그룹만 빠지고 검색은 성공한다', async () => {
    mockGetWasteDistrictDisplay.mockResolvedValue(null);
    mockListWasteAreas.mockRejectedValue(new ServiceUnavailableError('준비되지 않음', 'WASTE_AREA_UNAVAILABLE'));
    const result = await searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toBeUndefined();
  });

  it('ServiceUnavailableError 가 아닌 오류는 그대로 던진다', async () => {
    mockGetWasteDistrictDisplay.mockResolvedValue(null);
    mockListWasteAreas.mockRejectedValue(new Error('boom'));
    await expect(searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any)).rejects.toThrow('boom');
  });
});
