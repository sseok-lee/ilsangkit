import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindUnique, mockCount } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    subwayStation: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
    },
  };
  return { default: prismaClient, prisma: prismaClient };
});

import {
  findNearbyStations,
  getStationBySlug,
  serializeStation,
  listStations,
} from '../../src/services/subwayService.js';

describe('findNearbyStations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1km 반경에서 BBox 후보 중 거리 ≤ radius만 반환', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 's1', name: '강남', nameSlug: 'gangnam', line: '2호선', lat: 37.4979, lng: 127.0276 },
      { id: 's2', name: '신논현', nameSlug: 'sinnonhyeon', line: '신분당선', lat: 37.5048, lng: 127.0246 },
      { id: 's3', name: '사당', nameSlug: 'sadang', line: '2호선', lat: 37.4767, lng: 126.9818 },
    ]);

    const result = await findNearbyStations(37.4979, 127.0276, 1000);
    const names = result.map((s) => s.name);
    expect(names).toContain('강남');
    expect(names).toContain('신논현');
    expect(names).not.toContain('사당');
    expect(result[0].name).toBe('강남');
    expect(result[0].nameSlug).toBe('gangnam');
    expect(result[0].type).toBe('subway');
    expect(result[0].distance).toBeLessThanOrEqual(50);
  });

  it('limit 옵션으로 결과 개수 제한', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 's1', name: '강남', nameSlug: 'gangnam', line: '2호선', lat: 37.4979, lng: 127.0276 },
      { id: 's2', name: '역삼', nameSlug: 'yeoksam', line: '2호선', lat: 37.5006, lng: 127.0366 },
      { id: 's3', name: '신논현', nameSlug: 'sinnonhyeon', line: '신분당선', lat: 37.5048, lng: 127.0246 },
    ]);

    const result = await findNearbyStations(37.4979, 127.0276, 5000, 2);
    expect(result.length).toBe(2);
  });

  it('빈 후보는 빈 배열', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    expect(await findNearbyStations(37.5, 127.0, 1000)).toEqual([]);
  });
});

describe('serializeStation', () => {
  it('Decimal-like lat/lng를 Number로, transferLines를 array로', () => {
    const station = {
      id: 'subway-1',
      sourceId: '0222-S1102',
      name: '강남',
      nameSlug: 'gangnam',
      line: '2호선',
      transferLines: '["신분당선","9호선"]',
      operator: '서울교통공사',
      lat: { toString: () => '37.4979' } as unknown as number,
      lng: { toString: () => '127.0276' } as unknown as number,
      address: '서울특별시 강남구 강남대로 396',
      roadAddress: '서울특별시 강남구 강남대로 396',
      city: '서울',
      district: '강남구',
      regionSlug: 'seoul',
      phoneNumber: '02-6110-2221',
      dataDate: '2024-12-31',
      createdAt: new Date('2026-05-07'),
      updatedAt: new Date('2026-05-07'),
      syncedAt: new Date('2026-05-07'),
    };

    const s = serializeStation(station as never);
    expect(s.lat).toBe(37.4979);
    expect(s.lng).toBe(127.0276);
    expect(s.transferLines).toEqual(['신분당선', '9호선']);
    expect(s.name).toBe('강남');
    expect(s.nameSlug).toBe('gangnam');
  });

  it('transferLines가 null이면 빈 배열', () => {
    const station = {
      id: 'subway-2',
      sourceId: '0001-X1',
      name: 'Test',
      nameSlug: 'test',
      line: '1호선',
      transferLines: null,
      operator: null,
      lat: 37.5 as unknown as number,
      lng: 127.0 as unknown as number,
      address: null,
      roadAddress: null,
      city: null,
      district: null,
      regionSlug: null,
      phoneNumber: null,
      dataDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
    };
    const s = serializeStation(station as never);
    expect(s.transferLines).toEqual([]);
  });
});

describe('getStationBySlug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('미존재 slug는 null', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const result = await getStationBySlug('not-exist');
    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { nameSlug: 'not-exist' } });
  });
});

describe('listStations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('페이지네이션 + 직렬화', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'subway-1',
        sourceId: '0222-S1102',
        name: '강남',
        nameSlug: 'gangnam',
        line: '2호선',
        transferLines: null,
        operator: '서울교통공사',
        lat: 37.4979,
        lng: 127.0276,
        address: null,
        roadAddress: null,
        city: '서울',
        district: '강남구',
        regionSlug: 'seoul',
        phoneNumber: null,
        dataDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncedAt: new Date(),
      },
    ]);
    mockCount.mockResolvedValueOnce(1);

    const r = await listStations({ page: 1, limit: 20, line: '2호선' });
    expect(r.total).toBe(1);
    expect(r.items[0].nameSlug).toBe('gangnam');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { line: '2호선' }, take: 20, skip: 0 }),
    );
  });
});
