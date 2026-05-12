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
  listStationsGrouped,
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

describe('listStationsGrouped', () => {
  beforeEach(() => vi.clearAllMocks());

  function row(overrides: Partial<Record<string, unknown>>) {
    return {
      id: 'r',
      sourceId: 'src',
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
      ...overrides,
    };
  }

  it('단일 노선역은 1건, lines=[해당 노선]', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'g1', sourceId: '0222-S1', name: '강남', nameSlug: 'gangnam', line: '2호선' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].nameSlug).toBe('gangnam');
    expect(r.items[0].lines).toEqual(['2호선']);
  });

  it('환승역 2노선은 1건 그룹핑, lines 합집합 사전순', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'sa1', sourceId: '0226-S1', name: '사당', nameSlug: 'sadang', line: '2호선' }),
      row({ id: 'sa2', sourceId: '0226-S2', name: '사당', nameSlug: 'sadang', line: '4호선' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].nameSlug).toBe('sadang');
    expect(r.items[0].lines).toEqual(['2호선', '4호선']);
  });

  it('환승역 3+노선은 1건 + transferLines JSON 합집합 흡수', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'j1', sourceId: 'J1', name: '종로3가', nameSlug: 'jongno-3-ga', line: '1호선', transferLines: '["3호선","5호선"]' }),
      row({ id: 'j2', sourceId: 'J3', name: '종로3가', nameSlug: 'jongno-3-ga', line: '3호선', transferLines: '["1호선","5호선"]' }),
      row({ id: 'j3', sourceId: 'J5', name: '종로3가', nameSlug: 'jongno-3-ga', line: '5호선', transferLines: '["1호선","3호선"]' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].lines.length).toBeGreaterThanOrEqual(3);
    expect(r.items[0].lines).toContain('1호선');
    expect(r.items[0].lines).toContain('3호선');
    expect(r.items[0].lines).toContain('5호선');
    const sorted = [...r.items[0].lines].sort();
    expect(r.items[0].lines).toEqual(sorted);
  });

  it('suffix-collision row도 동일 역명/도시/구이면 1그룹으로 병합', async () => {
    // slugifyStation의 line suffix 충돌 회피 로직으로 nameSlug가 분기되는 경우,
    // (name, city, district)가 같으면 그룹은 단일. 응답 nameSlug = 사전순 최소 슬러그.
    mockFindMany.mockResolvedValueOnce([
      row({ id: 's1', sourceId: 'X1', name: '시청', nameSlug: 'sicheong', line: '1호선', city: '서울', district: '중구' }),
      row({ id: 's2', sourceId: 'X2', name: '시청', nameSlug: 'sicheong-line2', line: '2호선', city: '서울', district: '중구' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].name).toBe('시청');
    expect(r.items[0].nameSlug).toBe('sicheong'); // 사전순 minimum = canonical
    expect(r.items[0].lines).toEqual(['1호선', '2호선']);
  });

  it('동명역이 도시/구가 다르면 별도 그룹', async () => {
    // 서울 중구 시청 vs 부산 중구 시청은 다른 역
    mockFindMany.mockResolvedValueOnce([
      row({ id: 's1', sourceId: 'X1', name: '시청', nameSlug: 'sicheong-seoul', line: '1호선', city: '서울', district: '중구' }),
      row({ id: 's2', sourceId: 'X2', name: '시청', nameSlug: 'sicheong-busan', line: '1호선', city: '부산', district: '중구' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(r.total).toBe(2);
  });

  it('city variant 매칭 — citySlug=seoul → 서울/서울특별시 양쪽 row 모두 포함', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'a', sourceId: 'A', name: '강남', nameSlug: 'gangnam', line: '2호선', city: '서울' }),
      row({ id: 'b', sourceId: 'B', name: '역삼', nameSlug: 'yeoksam', line: '2호선', city: '서울특별시' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20, citySlug: 'seoul' });
    expect(r.total).toBe(2);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: expect.objectContaining({ in: expect.arrayContaining(['서울', '서울특별시']) }),
        }),
      }),
    );
  });

  it('keyword 필터는 name 부분 일치', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'k', sourceId: 'K', name: '종로3가', nameSlug: 'jongno-3-ga', line: '1호선' }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20, keyword: '종로3가' });
    expect(r.total).toBe(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: expect.objectContaining({ contains: '종로3가' }),
        }),
      }),
    );
  });

  it('Decimal lat/lng는 number로 변환', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({
        id: 'd', sourceId: 'D', name: 'X', nameSlug: 'x', line: '1호선',
        lat: { toString: () => '37.5' } as unknown as number,
        lng: { toString: () => '127.0' } as unknown as number,
      }),
    ]);
    const r = await listStationsGrouped({ page: 1, limit: 20 });
    expect(typeof r.items[0].lat).toBe('number');
    expect(r.items[0].lat).toBe(37.5);
    expect(typeof r.items[0].lng).toBe('number');
    expect(r.items[0].lng).toBe(127.0);
  });

  it('페이지네이션은 그룹핑 후 적용', async () => {
    mockFindMany.mockResolvedValueOnce([
      row({ id: 'r1', sourceId: 's1', name: 'A역', nameSlug: 'a' }),
      row({ id: 'r2', sourceId: 's2', name: 'B역', nameSlug: 'b' }),
      row({ id: 'r3', sourceId: 's3', name: 'C역', nameSlug: 'c' }),
    ]);
    const r = await listStationsGrouped({ page: 2, limit: 2 });
    expect(r.total).toBe(3);
    expect(r.items.length).toBe(1);
    expect(r.page).toBe(2);
    expect(r.limit).toBe(2);
  });
});
