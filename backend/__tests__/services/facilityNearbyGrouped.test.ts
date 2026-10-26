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

type Row = { id: string; name: string; lat: number | null; lng: number | null };

/** 1단계(좌표 스캔)·2단계(id 로 이름 붙이기) 를 흉내 낸다. */
function useRows(rows: Row[]) {
  mockFindMany.mockImplementation(async (arg: { select: Record<string, boolean>; where: any }) => {
    if (arg.select.name) {
      const ids: string[] = arg.where.id.in;
      return rows.filter((r) => ids.includes(r.id)).map((r) => ({ id: r.id, name: r.name }));
    }
    return rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng }));
  });
}

function scanCalls() {
  return mockFindMany.mock.calls.filter((c) => !c[0].select.name);
}
function nameCalls() {
  return mockFindMany.mock.calls.filter((c) => c[0].select.name);
}

beforeEach(() => {
  mockFindMany.mockReset();
});

describe('nearbyGrouped', () => {
  it('반경 밖 시설은 개수·목록 모두에서 뺀다', async () => {
    useRows([row('a', '가', 500), row('b', '나', 1500)]);

    const result = await nearbyGrouped({ ...CENTER, radius: 1000, categories: ['school'], limit: 5 });

    expect(result.school.count).toBe(1);
    expect(result.school.items.map((i) => i.id)).toEqual(['a']);
  });

  it('거리 오름차순으로 limit 개만 돌려주고, 거리는 m 정수로 반올림한다', async () => {
    useRows([
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
    useRows(Array.from({ length: 64 }, (_, i) => row(`h${i}`, `병원${i}`, 10 + i * 10)));

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['hospital'], limit: 5 });

    expect(result.hospital).toMatchObject({ count: 64, exact: true });
    expect(result.hospital.items).toHaveLength(5);
  });

  it('스캔 상한에 걸리면 exact=false', async () => {
    useRows(
      Array.from({ length: NEARBY_SUMMARY.SCAN_CAP }, (_, i) => row(`h${i}`, `병원${i}`, 100)),
    );

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['hospital'], limit: 5 });

    expect(result.hospital.exact).toBe(false);
    expect(result.hospital.count).toBe(NEARBY_SUMMARY.SCAN_CAP);
  });

  it('같은 이름+같은 좌표 중복은 하나로, 같은 좌표라도 이름이 다르면 각각 유지한다', async () => {
    useRows([
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
    useRows([row('b', '하늘공원', 300), row('a', '가람공원', 300)]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['park'], limit: 5 });

    expect(result.park.items.map((i) => i.name)).toEqual(['가람공원', '하늘공원']);
  });

  it('좌표가 NULL 인 행은 무시한다', async () => {
    useRows([row('a', '가', 100), { id: 'n', name: '널', lat: null, lng: null }]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['sports'], limit: 5 });

    expect(result.sports.count).toBe(1);
    expect(result.sports.items.map((i) => i.id)).toEqual(['a']);
  });

  it('1단계는 id·lat·lng 만 select 하고 바운딩박스·스캔 상한을 건다', async () => {
    useRows([]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['school', 'childcare'], limit: 5 });

    // 반경 안이 비면 이름 조회(2단계)는 하지 않는다
    expect(mockFindMany).toHaveBeenCalledTimes(2);
    expect(nameCalls()).toHaveLength(0);
    const arg = mockFindMany.mock.calls[0][0];
    // name 을 빼야 (lat,lng) 인덱스만으로 스캔한다(커버링, "Using index")
    expect(arg.select).toEqual({ id: true, lat: true, lng: true });
    expect(arg.take).toBe(NEARBY_SUMMARY.SCAN_CAP);
    expect(arg.where.lat.gte).toBeCloseTo(37.5 - 2 / 111, 6);
    expect(result).toEqual({
      school: { count: 0, exact: true, items: [] },
      childcare: { count: 0, exact: true, items: [] },
    });
  });

  it('2단계 이름 조회는 가까운 후보 limit*3 개 id 로만 한다', async () => {
    useRows(Array.from({ length: 64 }, (_, i) => row(`h${i}`, `병원${i}`, 10 + i * 10)));

    await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['hospital'], limit: 5 });

    expect(scanCalls()).toHaveLength(1);
    expect(nameCalls()).toHaveLength(1);
    const arg = nameCalls()[0][0];
    expect(arg.select).toEqual({ id: true, name: true });
    expect(arg.where.id.in).toEqual(Array.from({ length: 15 }, (_, i) => `h${i}`));
  });

  it('dedupe 로 모자라면 다음 후보 묶음을 이어서 가져온다', async () => {
    // limit 2 → 첫 묶음 6개가 모두 같은 이름+좌표라 1곳뿐 → 다음 묶음에서 나머지를 채운다
    useRows([
      ...Array.from({ length: 6 }, (_, i) => row(`d${i}`, '중복약국', 100)),
      row('x', '다른약국', 900),
    ]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['pharmacy'], limit: 2 });

    expect(result.pharmacy.items.map((i) => i.name)).toEqual(['중복약국', '다른약국']);
    expect(result.pharmacy.count).toBe(7);
    expect(nameCalls()).toHaveLength(2);
  });

  it('후보를 다 써도 모자라면 있는 만큼만 돌려준다', async () => {
    useRows([row('a', '같은곳', 100), row('b', '같은곳', 100)]);

    const result = await nearbyGrouped({ ...CENTER, radius: 2000, categories: ['park'], limit: 5 });

    expect(result.park.items.map((i) => i.id)).toEqual(['a']);
    expect(nameCalls()).toHaveLength(1);
  });
});
