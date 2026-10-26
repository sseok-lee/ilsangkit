// 지하철역 상세 "주변 시설" — 역 좌표 기준 반경 1km, [주변 역, ...CROSS_CATEGORY_MAP.subway] 그룹
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown> & { id: string; name: string; lat: number | null; lng: number | null };

const { db, mockStationSearch, mockBufferView } = vi.hoisted(() => ({
  /** 카테고리(prisma 모델 키)별 행 */
  db: {} as Record<string, Row[]>,
  mockStationSearch: vi.fn(),
  mockBufferView: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  // 시설: 1단계(좌표 스캔: select id·lat·lng) / 2단계(id in → listFields) 를 흉내 낸다.
  // 지하철역: findUnique(nameSlug) / findMany(바운딩박스 where) 를 흉내 낸다.
  const makeModel = (key: string) => ({
    findMany: vi.fn(async (arg: { select: Record<string, boolean>; where: any }) => {
      const rows = db[key] ?? [];
      if (arg.where?.id?.in) {
        const ids: string[] = arg.where.id.in;
        return rows
          .filter((r) => ids.includes(r.id))
          .map((r) => Object.fromEntries(Object.keys(arg.select).filter((k) => k in r).map((k) => [k, r[k]])));
      }
      const { lat, lng } = arg.where ?? {};
      return rows
        .filter((r) => r.lat !== null && r.lng !== null)
        .filter((r) => !lat || ((r.lat as number) >= lat.gte && (r.lat as number) <= lat.lte))
        .filter((r) => !lng || ((r.lng as number) >= lng.gte && (r.lng as number) <= lng.lte))
        .map((r) => Object.fromEntries(Object.keys(arg.select).filter((k) => k in r).map((k) => [k, r[k]])));
    }),
    findUnique: vi.fn(async (arg: { where: Record<string, string> }) => {
      const [[field, value]] = Object.entries(arg.where);
      return (db[key] ?? []).find((r) => r[field] === value) ?? null;
    }),
    count: vi.fn(),
    update: vi.fn(),
  });
  const prismaClient = {
    toilet: makeModel('toilet'), wifi: makeModel('wifi'), clothes: makeModel('clothes'),
    parking: makeModel('parking'), aed: makeModel('aed'), library: makeModel('library'),
    hospital: makeModel('hospital'), pharmacy: makeModel('pharmacy'), park: makeModel('park'),
    school: makeModel('school'), market: makeModel('market'), childcare: makeModel('childcare'),
    evCharger: makeModel('evCharger'), sports: makeModel('sports'),
    subwayStation: makeModel('subwayStation'), wasteSchedule: makeModel('wasteSchedule'),
    region: { findFirst: vi.fn() },
    $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn(),
  };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/evChargerService.js', () => ({
  evChargerStationSearch: mockStationSearch,
  getEvChargerStationDetail: vi.fn(),
}));

vi.mock('../../src/services/viewCountService.js', () => ({
  bufferViewCount: mockBufferView,
  flushViewCounts: vi.fn(),
}));

import { nearbyGroupedForStation } from '../../src/services/subwayService.js';

// 중심 (37.5, 127.0). 이 위도에서 경도 0.001° ≈ 88m.
const CENTER = { lat: 37.5, lng: 127.0 };
const LNG_PER_M = 1 / (111_000 * Math.cos((37.5 * Math.PI) / 180));

function at(meters: number) {
  return { lat: CENTER.lat, lng: CENTER.lng + meters * LNG_PER_M };
}

function st(id: string, name: string, nameSlug: string, line: string, meters: number): Row {
  return { id, name, nameSlug, line, ...at(meters) };
}

function row(id: string, name: string, meters: number, extra: Record<string, unknown> = {}): Row {
  return {
    id, name, ...at(meters),
    address: '경기도 화성시 병점동 1', roadAddress: '경기도 화성시 병점노을4로 29', city: '경기도', district: '화성시',
    ...extra,
  };
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  mockStationSearch.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
  mockBufferView.mockReset();
});

describe('nearbyGroupedForStation', () => {
  it('역이 없으면 null', async () => {
    expect(await nearbyGroupedForStation('nope', 5)).toBeNull();
  });

  it('좌표가 없으면 groups 가 빈 배열', async () => {
    db.subwayStation = [{ ...st('me', '병점', 'byeongjeom', '1호선', 0), lat: null, lng: null }];
    expect(await nearbyGroupedForStation('byeongjeom', 5)).toEqual({ radius: 1000, groups: [] });
  });

  it('그룹 순서 = 주변 역, 그다음 CROSS_CATEGORY_MAP.subway 순서(0곳 그룹도 포함)', async () => {
    db.subwayStation = [st('me', '병점', 'byeongjeom', '1호선', 0)];
    const result = await nearbyGroupedForStation('byeongjeom', 5);
    expect(result?.radius).toBe(1000);
    expect(result?.groups.map((g) => g.category)).toEqual(['subway', 'parking', 'ev-charger', 'toilet', 'market']);
    expect(result?.groups.every((g) => g.exact)).toBe(true);
  });

  it('주변 역: 같은 역명(끝 "역" 정규화)의 노선을 합치고, 가장 가까운 행 기준, 자기 역(다른 노선 행 포함) 제외', async () => {
    db.subwayStation = [
      st('me', '강남', 'gangnam', '2호선', 0),
      st('me2', '강남역', 'gangnam-sinbundang', '신분당선', 30),
      st('a1', '역삼', 'yeoksam', '2호선', 800),
      st('b1', '신논현역', 'sinnonhyeon-sinbundang', '신분당선', 500),
      st('b2', '신논현', 'sinnonhyeon', '9호선', 450),
      st('far', '교대', 'gyodae', '2호선', 1500),
    ];
    const result = await nearbyGroupedForStation('gangnam', 5);
    const subway = result!.groups[0];
    expect(subway.category).toBe('subway');
    // count = 역명 단위(신논현 1 + 역삼 1)
    expect(subway.count).toBe(2);
    expect(subway.items.map((i) => i.nameSlug)).toEqual(['sinnonhyeon', 'yeoksam']);
    expect(subway.items[0]).toMatchObject({ name: '신논현', category: 'subway', lines: ['9호선', '신분당선'] });
    expect(Number.isInteger(subway.items[0].distance)).toBe(true);
    expect(subway.items[0].distance).toBeGreaterThanOrEqual(449);
    expect(subway.items[0].distance).toBeLessThanOrEqual(451);
    expect(subway.items[1]).toMatchObject({ nameSlug: 'yeoksam', lines: ['2호선'] });
  });

  it('주변 역: count 는 limit 와 무관한 역명 수, items 는 거리순 limit 개', async () => {
    db.subwayStation = [
      st('me', '병점', 'byeongjeom', '1호선', 0),
      st('s1', '가', 'ga', '1호선', 900),
      st('s2', '나', 'na', '1호선', 100),
      st('s3', '다', 'da', '1호선', 300),
      st('s4', '다', 'da-2', '2호선', 350),
    ];
    const result = await nearbyGroupedForStation('byeongjeom', 2);
    const subway = result!.groups[0];
    expect(subway.count).toBe(3);
    expect(subway.items.map((i) => i.nameSlug)).toEqual(['na', 'da']);
  });

  it('관련 카테고리는 시설 상세와 같은 그룹 조회(2단계 listFields·m 정수 거리)를 쓰고 자기 제외가 없다', async () => {
    db.subwayStation = [st('me', '병점', 'byeongjeom', '1호선', 0)];
    db.parking = [row('p1', '병점역 공영주차장', 0), row('p2', '먼 주차장', 1500)];
    db.toilet = [row('t1', '병점역 화장실', 50, { openTime: '05:00~24:00' })];
    const result = await nearbyGroupedForStation('byeongjeom', 5);
    const byCat = Object.fromEntries(result!.groups.map((g) => [g.category, g]));
    expect(byCat.parking.count).toBe(1);
    expect(byCat.parking.items.map((i: { id: string }) => i.id)).toEqual(['p1']);
    expect(byCat.toilet.items[0]).toMatchObject({
      id: 't1', category: 'toilet', roadAddress: '경기도 화성시 병점노을4로 29',
    });
    expect(byCat.market.count).toBe(0);
  });

  it('ev-charger 는 충전소 단위 검색을 반경 1km 로 쓰고 count 는 그 total', async () => {
    db.subwayStation = [st('me', '병점', 'byeongjeom', '1호선', 0)];
    mockStationSearch.mockResolvedValue({
      items: [
        { id: 's1', category: 'ev-charger', name: '충전소1', distance: 100, extras: { rapidCount: 1 } },
        { id: 's2', category: 'ev-charger', name: '충전소2', distance: 200, extras: {} },
      ],
      total: 2, page: 1, totalPages: 1,
    });
    const result = await nearbyGroupedForStation('byeongjeom', 1);
    const ev = result!.groups.find((g) => g.category === 'ev-charger')!;
    expect(mockStationSearch).toHaveBeenCalledWith(expect.objectContaining({ lat: CENTER.lat, lng: CENTER.lng, radius: 1000, page: 1 }));
    expect(ev.count).toBe(2);
    expect(ev.items.map((i) => i.id)).toEqual(['s1']);
  });

  it('조회수를 올리지 않는다', async () => {
    db.subwayStation = [st('me', '병점', 'byeongjeom', '1호선', 0)];
    await nearbyGroupedForStation('byeongjeom', 5);
    expect(mockBufferView).not.toHaveBeenCalled();
  });
});
