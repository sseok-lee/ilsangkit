import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError } from '../../src/lib/errors.js';

type ModelCall = { where?: Record<string, unknown>; skip?: number; take?: number; orderBy?: unknown };

const {
  modelCalls,
  mockParkingCount,
  mockParkingFindMany,
  mockHospitalCount,
  mockHospitalFindMany,
  mockWasteCount,
  mockWasteFindMany,
  mockRegionFindFirst,
  mockWifiGroupSearch,
  mockEvChargerStationSearch,
  mockListStationsGrouped,
  mockListWasteAreas,
} = vi.hoisted(() => ({
  modelCalls: [] as Array<{ model: string; method: string; args: ModelCall }>,
  mockParkingCount: vi.fn(),
  mockParkingFindMany: vi.fn(),
  mockHospitalCount: vi.fn(),
  mockHospitalFindMany: vi.fn(),
  mockWasteCount: vi.fn(),
  mockWasteFindMany: vi.fn(),
  mockRegionFindFirst: vi.fn(),
  mockWifiGroupSearch: vi.fn(),
  mockEvChargerStationSearch: vi.fn(),
  mockListStationsGrouped: vi.fn(),
  mockListWasteAreas: vi.fn(),
}));

function emptyModel(name: string) {
  return {
    count: vi.fn(async (args: ModelCall) => {
      modelCalls.push({ model: name, method: 'count', args });
      return 0;
    }),
    findMany: vi.fn(async (args: ModelCall) => {
      modelCalls.push({ model: name, method: 'findMany', args });
      return [];
    }),
  };
}

vi.mock('../../src/lib/prisma.js', () => {
  const models: Record<string, unknown> = {
    toilet: emptyModel('toilet'),
    wifi: emptyModel('wifi'),
    clothes: emptyModel('clothes'),
    parking: {
      count: mockParkingCount,
      findMany: mockParkingFindMany,
    },
    aed: emptyModel('aed'),
    library: emptyModel('library'),
    hospital: {
      count: mockHospitalCount,
      findMany: mockHospitalFindMany,
    },
    pharmacy: emptyModel('pharmacy'),
    park: emptyModel('park'),
    school: emptyModel('school'),
    market: emptyModel('market'),
    childcare: emptyModel('childcare'),
    evCharger: emptyModel('evCharger'),
    sports: emptyModel('sports'),
    subwayStation: emptyModel('subwayStation'),
    wasteSchedule: {
      count: mockWasteCount,
      findMany: mockWasteFindMany,
    },
    region: { findFirst: mockRegionFindFirst },
    $queryRawUnsafe: vi.fn(async () => []),
  };
  return { default: models, prisma: models };
});

vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return {
    ...actual,
    canUseFulltext: () => false,
  };
});

vi.mock('../../src/services/wifiService.js', () => ({
  wifiGroupSearch: mockWifiGroupSearch,
}));

vi.mock('../../src/services/evChargerService.js', () => ({
  evChargerStationSearch: mockEvChargerStationSearch,
  getEvChargerStationDetail: vi.fn(),
}));

vi.mock('../../src/services/subwayService.js', () => ({
  listStationsGrouped: mockListStationsGrouped,
}));

vi.mock('../../src/services/wasteAreaService.js', () => ({
  isWasteAreaDiscoveryEnabled: () => process.env.WASTE_AREA_DISCOVERY_ENABLED === 'true',
  listWasteAreas: mockListWasteAreas,
}));

import { browseFacilities } from '../../src/services/facilityBrowseService.js';
import { searchInExplicitRegion } from '../../src/services/facilityService.js';

const region = { city: '서울특별시', district: '강남구', slug: 'gangnam' };

const parkingRows = Array.from({ length: 21 }, (_, i) => ({
  id: `parking-${i + 1}`,
  name: `공영주차장 ${String(i + 1).padStart(2, '0')}`,
  address: `서울특별시 강남구 ${i + 1}`,
  roadAddress: null,
  lat: 37.5 + i / 1000,
  lng: 127 + i / 1000,
  city: '서울특별시',
  district: '강남구',
  capacity: 10 + i,
  baseFee: i,
  feeType: '유료',
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
  modelCalls.length = 0;
  mockRegionFindFirst.mockResolvedValue(region);
  mockParkingCount.mockImplementation(async (args: ModelCall) => {
    modelCalls.push({ model: 'parking', method: 'count', args });
    return parkingRows.length;
  });
  mockParkingFindMany.mockImplementation(async (args: ModelCall) => {
    modelCalls.push({ model: 'parking', method: 'findMany', args });
    const skip = args.skip ?? 0;
    const take = args.take ?? parkingRows.length;
    return parkingRows.slice(skip, skip + take);
  });
  mockHospitalCount.mockImplementation(async (args: ModelCall) => {
    modelCalls.push({ model: 'hospital', method: 'count', args });
    return 0;
  });
  mockHospitalFindMany.mockImplementation(async (args: ModelCall) => {
    modelCalls.push({ model: 'hospital', method: 'findMany', args });
    return [];
  });
  mockWasteCount.mockResolvedValue(2);
  mockWasteFindMany.mockResolvedValue([
    { id: 11, targetRegion: '역삼1동', emissionPlace: '집 앞', city: '서울특별시', district: '강남구' },
    { id: 12, targetRegion: '역삼2동', emissionPlace: '공동배출', city: '서울특별시', district: '강남구' },
  ]);
  mockListWasteAreas.mockResolvedValue({
    generationId: 'generation-1',
    items: [
      { areaId: 7, name: '역삼1동', city: '서울특별시', district: '강남구', href: '/trash/areas/7', matchReason: 'region', scheduleCount: 1, conditionalCount: 1, summary: '역삼1동 전체', dataDate: '2026-09-28T00:00:00.000Z' },
      { areaId: 8, name: '역삼2동', city: '서울특별시', district: '강남구', href: '/trash/areas/8', matchReason: 'region', scheduleCount: 1, conditionalCount: 1, summary: '역삼2동 전체', dataDate: '2026-09-28T00:00:00.000Z' },
      { areaId: 9, name: '삼성1동', city: '서울특별시', district: '강남구', href: '/trash/areas/9', matchReason: 'region', scheduleCount: 2, conditionalCount: 2, summary: '삼성1동 전체', dataDate: null },
    ],
    total: 16,
    page: 1,
    totalPages: 1,
    unresolved: { count: 0, href: null },
  });
  mockWifiGroupSearch.mockResolvedValue({
    items: [{
      id: 'wifi-group-1',
      category: 'wifi',
      name: '강남 무료와이파이',
      address: '서울특별시 강남구',
      roadAddress: null,
      lat: 37.5,
      lng: 127,
      city: '서울특별시',
      district: '강남구',
      extras: { accessPointCount: 8 },
    }],
    total: 1,
    page: 1,
    totalPages: 1,
  });
  mockEvChargerStationSearch.mockResolvedValue({
    items: [
      {
        id: 'STAT-1',
        category: 'ev-charger',
        name: '강남충전소',
        address: null,
        roadAddress: null,
        lat: 37.5,
        lng: 127,
        city: '서울특별시',
        district: '강남구',
        extras: { totalChargers: 4 },
      },
      {
        id: 'STAT-2',
        category: 'ev-charger',
        name: '역삼충전소',
        address: null,
        roadAddress: null,
        lat: 37.51,
        lng: 127.01,
        city: '서울특별시',
        district: '강남구',
        extras: { totalChargers: 4 },
      },
    ],
    total: 2,
    page: 1,
    totalPages: 1,
  });
  mockListStationsGrouped.mockResolvedValue({
    items: [{
      id: 'subway-row-1',
      sourceId: 'src',
      name: '강남',
      nameSlug: 'gangnam',
      primaryLine: '2호선',
      lines: ['2호선', '신분당선'],
      operator: '서울교통공사',
      lat: 37.4979,
      lng: 127.0276,
      address: null,
      roadAddress: null,
      city: '서울특별시',
      district: '강남구',
      regionSlug: 'seoul',
      phoneNumber: null,
      dataDate: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    total: 1,
    page: 1,
    limit: 20,
  });
});

describe('browseFacilities', () => {
  it('keeps grouped previews identical to the first page', async () => {
    const scope = { city: 'seoul', district: 'gangnam', page: 1, limit: 20 };
    const grouped = await browseFacilities(scope);
    const list = await browseFacilities({ ...scope, category: 'parking' });
    if (grouped.mode !== 'grouped' || list.mode !== 'list') throw new Error('wrong mode');
    const parking = grouped.groups.find((x) => x.category === 'parking')!;
    expect(parking.count).toBe(list.total);
    expect(parking.items).toEqual(list.items.slice(0, 3));
  });

  it('does not reinterpret the selected region from keyword text', async () => {
    await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'parking', keyword: '부산', page: 1, limit: 20 });
    expect(mockRegionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'gangnam' }),
      }),
    );
    const findCall = modelCalls.find((c) => c.model === 'parking' && c.method === 'findMany')!;
    expect(findCall.args.where).toMatchObject({
      city: { in: expect.arrayContaining(['서울특별시', '서울']) },
      district: '강남구',
    });
    expect(JSON.stringify(findCall.args.where)).toContain('부산');
  });

  it('passes literal wildcard characters to Prisma contains without widening them', async () => {
    await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'parking', keyword: '%_', page: 1, limit: 20 });

    const findCall = modelCalls.find((c) => c.model === 'parking' && c.method === 'findMany')!;
    expect(findCall.args.where?.OR).toEqual([
      { name: { contains: '\\%\\_' } },
      { address: { contains: '\\%\\_' } },
      { roadAddress: { contains: '\\%\\_' } },
    ]);
  });

  it('ignores departments outside hospital', async () => {
    await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'parking', departments: ['내과'], page: 1, limit: 20 });
    const findCall = modelCalls.find((c) => c.model === 'parking' && c.method === 'findMany')!;
    expect(findCall.args.where?.AND).toBeUndefined();
  });

  it('applies departments as AND filters for hospital only', async () => {
    await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'hospital', departments: ['내과', '정형외과'], page: 1, limit: 20 });
    const countCall = modelCalls.find((c) => c.model === 'hospital' && c.method === 'count')!;
    expect(countCall.args.where?.AND).toEqual([
      { departments: { some: { dgsbjtCdNm: '내과' } } },
      { departments: { some: { dgsbjtCdNm: '정형외과' } } },
    ]);
  });

  it('uses adapter unit counts for ev-charger, subway, and trash areas', async () => {
    const ev = await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'ev-charger', page: 1, limit: 20 });
    const subway = await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'subway', page: 1, limit: 20 });
    const trash = await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'trash', page: 1, limit: 20 });

    expect(ev).toMatchObject({ mode: 'list', unit: '충전소', total: 2 });
    expect(ev.mode === 'list' && ev.items.map((x) => x.id)).toEqual(['STAT-1', 'STAT-2']);
    expect(subway).toMatchObject({ mode: 'list', unit: '역', total: 1 });
    expect(subway.mode === 'list' && subway.items[0]).toMatchObject({
      id: 'gangnam',
      extras: { primaryLine: '2호선', lines: ['2호선', '신분당선'], operator: '서울교통공사' },
    });
    expect(trash).toMatchObject({ mode: 'list', unit: '지역', total: 16 });
    expect(trash.mode === 'list' && trash.items[0]).toMatchObject({
      id: '7',
      category: 'trash',
      name: '역삼1동',
      address: '서울특별시 강남구',
      lat: null,
      lng: null,
      destination: { kind: 'waste-area', href: '/trash/areas/7' },
    });
    expect(mockListWasteAreas).toHaveBeenCalledWith({
      city: '서울특별시',
      district: '강남구',
      keyword: undefined,
      page: 1,
      limit: 20,
    });
    expect(mockWasteFindMany).not.toHaveBeenCalled();
    expect(mockWasteCount).not.toHaveBeenCalled();
  });

  it('uses the same trash area total for grouped preview and full list', async () => {
    const scope = { city: 'seoul', district: 'gangnam', page: 1, limit: 20 };
    const grouped = await browseFacilities(scope);
    const list = await browseFacilities({ ...scope, category: 'trash' });
    if (grouped.mode !== 'grouped' || list.mode !== 'list') throw new Error('wrong mode');

    const trash = grouped.groups.find((x) => x.category === 'trash')!;
    expect(trash.unit).toBe('지역');
    expect(trash.count).toBe(16);
    expect(trash.items).toHaveLength(3);
    expect(list.total).toBe(16);
    expect(list.items).toHaveLength(3);
    expect(trash.items).toEqual(list.items.slice(0, 3));
  });

  it('keeps legacy trash schedules when waste area discovery is disabled', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;

    const trash = await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'trash', page: 1, limit: 20 });

    expect(trash).toMatchObject({ mode: 'list', unit: '일정', total: 2 });
    expect(trash.mode === 'list' && trash.items[0]).toMatchObject({
      id: '11',
      category: 'trash',
      name: '역삼1동',
    });
    expect(trash.mode === 'list' && trash.items[0].destination).toBeUndefined();
    expect(mockListWasteAreas).not.toHaveBeenCalled();
    expect(mockWasteFindMany).toHaveBeenCalled();
    expect(mockWasteCount).toHaveBeenCalled();
    expect(mockWasteFindMany.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();
    expect(mockWasteCount.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();
  });

  it('rejects the whole grouped request when one adapter rejects', async () => {
    mockWifiGroupSearch.mockRejectedValueOnce(new Error('wifi failed'));
    await expect(browseFacilities({ city: 'seoul', district: 'gangnam', page: 1, limit: 20 }))
      .rejects.toThrow('wifi failed');
  });

  it('keeps count and rows page boundaries consistent', async () => {
    const result = await browseFacilities({ city: 'seoul', district: 'gangnam', category: 'parking', page: 2, limit: 20 });
    expect(result).toMatchObject({ mode: 'list', total: 21, page: 2, totalPages: 2 });
    expect(result.mode === 'list' && result.items).toHaveLength(1);
    const countCall = modelCalls.find((c) => c.model === 'parking' && c.method === 'count')!;
    const findCall = modelCalls.find((c) => c.model === 'parking' && c.method === 'findMany')!;
    expect(findCall.args.where).toEqual(countCall.args.where);
    expect(findCall.args.skip).toBe(20);
    expect(findCall.args.take).toBe(20);
  });
});

describe('searchInExplicitRegion', () => {
  it('rejects subway because browse service owns the subway adapter', async () => {
    await expect(searchInExplicitRegion({
      category: 'subway',
      city: '서울특별시',
      district: '강남구',
      page: 1,
      limit: 20,
    })).rejects.toBeInstanceOf(ValidationError);
  });
});
