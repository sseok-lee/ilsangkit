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

const { mockListWasteAreas, mockGetByRegion } = vi.hoisted(() => ({
  mockListWasteAreas: vi.fn(),
  mockGetByRegion: vi.fn(),
}));

vi.mock('../../src/services/wasteAreaService.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/wasteAreaService.js');
  return {
    ...actual,
    isWasteAreaDiscoveryEnabled: () => true,
    listWasteAreas: mockListWasteAreas,
  };
});

vi.mock('../../src/services/wasteScheduleService.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/wasteScheduleService.js');
  return { ...actual, getByRegion: mockGetByRegion };
});

import { ServiceUnavailableError } from '../../src/lib/errors.js';
import { searchGrouped } from '../../src/services/facilityService.js';
import { prisma } from '../../src/lib/prisma.js';

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
    vi.mocked(prisma.region.findFirst).mockResolvedValue({ slug: 'uiwang-si' } as any);
  });

  it('구·군 지정 + source 모드면 원본 건수(unit 건)로 trash 그룹을 만든다', async () => {
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [], mode: 'source' });
    mockGetByRegion.mockResolvedValue({ items: [sourceItem], total: 339, page: 1, totalPages: 17 });
    const result = await searchGrouped({ keyword: '쓰레기', city: '경기도', district: '의왕시' } as any);
    const trash = result.categories.find((c) => c.category === 'trash');
    expect(trash).toMatchObject({ count: 339, unit: '건' });
    expect(trash?.items[0]).toMatchObject({ id: '501', category: 'trash' });
    expect(mockListWasteAreas).toHaveBeenCalledTimes(1);
    expect(mockGetByRegion).toHaveBeenCalledWith('경기도', '의왕시', '쓰레기', { page: 1, limit: 3 }); // 파서가 '쓰레기'를 카테고리로 보지 않아 freeText 로 남는다(기존 동작)
    // 전체 보기는 지역 페이지로 — /trash?keyword= 는 동 목록이라 source 구·군에선 비어 있다
    expect(trash?.moreHref).toBe(`/gyeonggi/uiwang-si/trash?keyword=${encodeURIComponent('쓰레기')}`);
  });

  it('source 모드 + 이름 키워드면 nameText 를 전달하고 moreHref 에 keyword 를 붙인다', async () => {
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [], mode: 'source' });
    mockGetByRegion.mockResolvedValue({ items: [sourceItem], total: 3, page: 1, totalPages: 1 });
    const result = await searchGrouped({ keyword: '내손동 쓰레기', city: '경기도', district: '의왕시' } as any);
    const trash = result.categories.find((c) => c.category === 'trash');
    const nameText = mockGetByRegion.mock.calls[0][2];
    expect(nameText).toBeTruthy();
    expect(mockListWasteAreas).toHaveBeenCalledWith(expect.objectContaining({ keyword: nameText }));
    expect(trash?.moreHref).toBe(`/gyeonggi/uiwang-si/trash?keyword=${encodeURIComponent(nameText)}`);
  });

  it('nameText 가 없으면(키워드 없음) moreHref 에 keyword 를 붙이지 않는다', async () => {
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [], mode: 'source' });
    mockGetByRegion.mockResolvedValue({ items: [sourceItem], total: 3, page: 1, totalPages: 1 });
    const result = await searchGrouped({ keyword: '강남구', city: '서울특별시', district: '강남구' } as any);
    const trash = result.categories.find((c) => c.category === 'trash');
    expect(mockGetByRegion.mock.calls[0][2]).toBeUndefined();
    expect(trash?.moreHref).toBe('/seoul/uiwang-si/trash');
  });

  it('slug 를 못 찾으면 moreHref 를 생략한다', async () => {
    vi.mocked(prisma.region.findFirst).mockResolvedValue(null);
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [], mode: 'source' });
    mockGetByRegion.mockResolvedValue({ items: [sourceItem], total: 3, page: 1, totalPages: 1 });
    const result = await searchGrouped({ keyword: '쓰레기', city: '경기도', district: '의왕시' } as any);
    expect(result.categories.find((c) => c.category === 'trash')?.moreHref).toBeUndefined();
  });

  it('source 모드 원본 0건이면 trash 그룹을 넣지 않는다', async () => {
    mockListWasteAreas.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, unresolved: [], mode: 'source' });
    mockGetByRegion.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    const result = await searchGrouped({ keyword: '없는곳', city: '경기도', district: '의왕시' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toBeUndefined();
  });

  it('areas 모드면 기존처럼 동 목록 그룹(unit 지역)', async () => {
    mockListWasteAreas.mockResolvedValue({
      items: [{ areaId: 101, name: '역삼1동', city: '서울특별시', district: '강남구', href: '/trash/areas/101', matchReason: 'region', scheduleCount: 1, conditionalCount: 0, summary: '', dataDate: null }],
      total: 22, page: 1, totalPages: 8, unresolved: [], mode: 'areas',
    });
    const result = await searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toMatchObject({ count: 22, unit: '지역' });
    expect(result.categories.find((c) => c.category === 'trash')?.moreHref).toBeUndefined();
    expect(mockGetByRegion).not.toHaveBeenCalled();
  });

  it('활성 세대가 없어 ServiceUnavailableError 가 나면 trash 그룹만 빠지고 검색은 성공한다', async () => {
    mockListWasteAreas.mockRejectedValue(new ServiceUnavailableError('준비되지 않음', 'WASTE_AREA_UNAVAILABLE'));
    const result = await searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any);
    expect(result.categories.find((c) => c.category === 'trash')).toBeUndefined();
  });

  it('ServiceUnavailableError 가 아닌 오류는 그대로 던진다', async () => {
    mockListWasteAreas.mockRejectedValue(new Error('boom'));
    await expect(searchGrouped({ keyword: '쓰레기', city: '서울특별시', district: '강남구' } as any)).rejects.toThrow('boom');
  });
});
