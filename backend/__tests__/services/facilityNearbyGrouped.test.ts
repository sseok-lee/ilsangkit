import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { findMany: mockFindMany, count: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const prismaClient = {
    toilet: model, wifi: model, clothes: model, parking: model, aed: model,
    library: model, hospital: model, pharmacy: model, park: model, school: model,
    market: model, childcare: model, evCharger: model, sports: model,
    subwayStation: model, wasteSchedule: model,
    region: { findFirst: vi.fn() },
    $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn(),
  };
  return { default: prismaClient, prisma: prismaClient };
});

import { nearbyGrouped } from '../../src/services/facilityService.js';
import { NEARBY_SUMMARY } from '../../src/constants/index.js';

// 중심 (37.5, 127.0). 이 위도에서 경도 0.001° ≈ 88m.
const CENTER = { lat: 37.5, lng: 127.0 };
const LNG_PER_M = 1 / (111_000 * Math.cos((37.5 * Math.PI) / 180));

/** 중심에서 정동쪽 m 미터 지점의 행 */
function row(id: string, name: string, meters: number) {
  return { id, name, lat: CENTER.lat, lng: CENTER.lng + meters * LNG_PER_M };
}

beforeEach(() => {
  mockFindMany.mockReset();
});

describe('nearbyGrouped', () => {
  it('반경 밖 시설은 개수·목록 모두에서 뺀다', async () => {
    mockFindMany.mockResolvedValue([row('a', '가', 500), row('b', '나', 1500)]);

    const result = await nearbyGrouped({ ...CENTER, radius: 1000, categories: ['school'], limit: 5 });

    expect(result.school.count).toBe(1);
    expect(result.school.items.map((i) => i.id)).toEqual(['a']);
  });

  it('거리 오름차순으로 limit 개만 돌려주고, 거리는 m 정수로 반올림한다', async () => {
    mockFindMany.mockResolvedValue([
      row('far', '먼곳', 800),
      row('near', '가까운곳', 100),
      row('mid', '중간', 400),
    ]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['park'], limit: 2 });

    expect(result.park.items.map((i) => i.id)).toEqual(['near', 'mid']);
    expect(result.park.items[0]).toMatchObject({ id: 'near', name: '가까운곳', category: 'park' });
    expect(Number.isInteger(result.park.items[0].distance)).toBe(true);
    expect(result.park.items[0].distance).toBeGreaterThanOrEqual(99);
    expect(result.park.items[0].distance).toBeLessThanOrEqual(101);
  });

  it('count 는 limit 와 무관한 반경 안 전체 수다', async () => {
    mockFindMany.mockResolvedValue(Array.from({ length: 64 }, (_, i) => row(`h${i}`, `병원${i}`, 10 + i * 10)));

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['hospital'], limit: 5 });

    expect(result.hospital).toMatchObject({ count: 64, exact: true });
    expect(result.hospital.items).toHaveLength(5);
  });

  it('스캔 상한에 걸리면 exact=false', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: NEARBY_SUMMARY.SCAN_CAP }, (_, i) => row(`h${i}`, `병원${i}`, 100)),
    );

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['hospital'], limit: 5 });

    expect(result.hospital.exact).toBe(false);
    expect(result.hospital.count).toBe(NEARBY_SUMMARY.SCAN_CAP);
  });

  it('같은 이름+같은 좌표 중복은 하나로, 같은 좌표라도 이름이 다르면 각각 유지한다', async () => {
    mockFindMany.mockResolvedValue([
      row('p1', '온누리약국', 200),
      row('p2', '온누리약국', 200),
      row('p3', '해맑은약국', 200),
    ]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['pharmacy'], limit: 5 });

    expect(result.pharmacy.items.map((i) => i.name)).toEqual(['온누리약국', '해맑은약국']);
    // count 는 dedupe 전 반경 안 수(countNearby 와 같은 의미)
    expect(result.pharmacy.count).toBe(3);
  });

  it('거리가 같으면 이름순', async () => {
    mockFindMany.mockResolvedValue([row('b', '하늘공원', 300), row('a', '가람공원', 300)]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['park'], limit: 5 });

    expect(result.park.items.map((i) => i.name)).toEqual(['가람공원', '하늘공원']);
  });

  it('좌표가 NULL 인 행은 무시한다', async () => {
    mockFindMany.mockResolvedValue([row('a', '가', 100), { id: 'n', name: '널', lat: null, lng: null }]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['sports'], limit: 5 });

    expect(result.sports.count).toBe(1);
    expect(result.sports.items.map((i) => i.id)).toEqual(['a']);
  });

  it('id·name·lat·lng 만 select 하고 바운딩박스·스캔 상한을 건다', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['school', 'childcare'], limit: 5 });

    expect(mockFindMany).toHaveBeenCalledTimes(2);
    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.select).toEqual({ id: true, name: true, lat: true, lng: true });
    expect(arg.take).toBe(NEARBY_SUMMARY.SCAN_CAP);
    expect(arg.where.lat.gte).toBeCloseTo(37.5 - 2 / 111, 6);
    expect(result).toEqual({
      school: { count: 0, exact: true, items: [] },
      childcare: { count: 0, exact: true, items: [] },
    });
  });
});
