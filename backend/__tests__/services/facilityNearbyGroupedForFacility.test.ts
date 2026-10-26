// 시설 상세 "주변 시설" — 시설 좌표 기준 반경 1km, [현재 카테고리(자기 제외), ...CROSS_CATEGORY_MAP] 그룹
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown> & { id: string; name: string; lat: number | null; lng: number | null };

const { db, mockStationSearch, mockWifiSearch, mockStationDetail, mockWifiGroupDetail, mockBufferView } = vi.hoisted(() => ({
  mockBufferView: vi.fn(),
  /** 카테고리(prisma 모델 키)별 행 */
  db: {} as Record<string, Row[]>,
  mockStationSearch: vi.fn(),
  mockWifiSearch: vi.fn(),
  mockStationDetail: vi.fn(),
  mockWifiGroupDetail: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  // 1단계(좌표 스캔: select id·lat·lng) / 2단계(id in → listFields) / 상세 좌표(findUnique) 를 흉내 낸다.
  const makeModel = (key: string) => ({
    findMany: vi.fn(async (arg: { select: Record<string, boolean>; where: any }) => {
      const rows = db[key] ?? [];
      if (arg.where?.id?.in) {
        const ids: string[] = arg.where.id.in;
        return rows
          .filter((r) => ids.includes(r.id))
          .map((r) => Object.fromEntries(Object.keys(arg.select).filter((k) => k in r).map((k) => [k, r[k]])));
      }
      return rows.filter((r) => r.lat !== null).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng }));
    }),
    findUnique: vi.fn(async (arg: { where: { id: string } }) => (db[key] ?? []).find((r) => r.id === arg.where.id) ?? null),
    // ev-charger: statId 로 첫 충전기(chgerId 순) 좌표
    findFirst: vi.fn(async (arg: { where: Record<string, unknown> }) => {
      const [[field, value]] = Object.entries(arg.where);
      return (db[key] ?? []).filter((r) => r[field] === value).sort((a, b) => String(a.chgerId ?? '').localeCompare(String(b.chgerId ?? '')))[0] ?? null;
    }),
    // wifi 그룹: groupId 행들의 좌표 평균(NULL 제외)
    aggregate: vi.fn(async (arg: { where: Record<string, unknown> }) => {
      const [[field, value]] = Object.entries(arg.where);
      const rows = (db[key] ?? []).filter((r) => r[field] === value);
      const located = rows.filter((r) => r.lat !== null && r.lng !== null);
      const avg = (k: 'lat' | 'lng') => (located.length ? located.reduce((sum, r) => sum + (r[k] as number), 0) / located.length : null);
      return { _count: { _all: rows.length }, _avg: { lat: avg('lat'), lng: avg('lng') } };
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
  getEvChargerStationDetail: mockStationDetail,
}));

vi.mock('../../src/services/wifiService.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  wifiGroupSearch: mockWifiSearch,
  getWifiGroupDetail: mockWifiGroupDetail,
}));

vi.mock('../../src/services/viewCountService.js', () => ({
  bufferViewCount: mockBufferView,
  flushViewCounts: vi.fn(),
}));

import { nearbyGroupedForFacility } from '../../src/services/facilityService.js';

// 중심 (37.5, 127.0). 이 위도에서 경도 0.001° ≈ 88m.
const CENTER = { lat: 37.5, lng: 127.0 };
const LNG_PER_M = 1 / (111_000 * Math.cos((37.5 * Math.PI) / 180));

function row(id: string, name: string, meters: number, extra: Record<string, unknown> = {}): Row {
  return {
    id, name, lat: CENTER.lat, lng: CENTER.lng + meters * LNG_PER_M,
    address: '경기도 화성시 병점동 1', roadAddress: '경기도 화성시 병점노을4로 29', city: '경기도', district: '화성시',
    ...extra,
  };
}

function station(id: string, distance: number) {
  return { id, category: 'ev-charger', name: `충전소${id}`, address: null, roadAddress: null, lat: 37.5, lng: 127.0, city: '', district: '', distance, extras: { rapidCount: 2, slowCount: 4 } };
}
function wifiGroup(id: string, distance: number) {
  return { id, category: 'wifi', name: `와이파이${id}`, address: null, roadAddress: null, lat: 37.5, lng: 127.0, city: '', district: '', distance, extras: { installLocation: '1층 로비' } };
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  mockStationSearch.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
  mockWifiSearch.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
  mockStationDetail.mockReset();
  mockWifiGroupDetail.mockReset();
  mockBufferView.mockReset();
});

describe('nearbyGroupedForFacility', () => {
  it('시설이 없으면 null', async () => {
    expect(await nearbyGroupedForFacility('pharmacy', 'pharmacy-x', 5)).toBeNull();
  });

  it('좌표가 없으면 groups 가 빈 배열', async () => {
    db.pharmacy = [{ ...row('me', '캐슬약국', 0), lat: null, lng: null }];
    expect(await nearbyGroupedForFacility('pharmacy', 'me', 5)).toEqual({ radius: 1000, groups: [] });
  });

  it('그룹 순서 = 현재 카테고리, 그다음 CROSS_CATEGORY_MAP 순서(0곳 그룹도 포함)', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0)];
    const result = await nearbyGroupedForFacility('pharmacy', 'me', 5);
    expect(result?.radius).toBe(1000);
    // CROSS_CATEGORY_MAP.pharmacy = ['hospital', 'childcare']
    expect(result?.groups.map((g) => g.category)).toEqual(['pharmacy', 'hospital', 'childcare']);
    expect(result?.groups.every((g) => g.exact)).toBe(true);
  });

  it('자기 자신은 목록과 count 에서 모두 뺀다', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0), row('p2', '온누리약국', 300), row('p3', '병점약국', 1500)];
    const result = await nearbyGroupedForFacility('pharmacy', 'me', 5);
    const same = result!.groups[0];
    expect(same.count).toBe(1);
    expect(same.items.map((i) => i.id)).toEqual(['p2']);
  });

  it('카테고리별 limit 이 독립 — 같은 건물 병원 4곳이 어린이집 자리를 뺏지 않는다', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0)];
    db.hospital = [
      row('h1', '가내과', 5), row('h2', '나치과', 5), row('h3', '다정형외과', 5), row('h4', '라소아과', 5),
    ];
    db.childcare = [row('c1', '키즈어린이집', 600)];
    const result = await nearbyGroupedForFacility('pharmacy', 'me', 2);
    const byCat = Object.fromEntries(result!.groups.map((g) => [g.category, g]));
    expect(byCat.hospital.count).toBe(4);
    expect(byCat.hospital.items.map((i) => i.id)).toEqual(['h1', 'h2']);
    expect(byCat.childcare.count).toBe(1);
    expect(byCat.childcare.items.map((i) => i.id)).toEqual(['c1']);
  });

  it('items 에 보조 줄용 listFields(extras)·주소·m 정수 거리가 붙는다', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0)];
    db.hospital = [row('h1', '가내과', 120, { clCdNm: '의원', drTotCnt: 2 })];
    const result = await nearbyGroupedForFacility('pharmacy', 'me', 5);
    const item = result!.groups[1].items[0];
    expect(item).toMatchObject({
      id: 'h1', name: '가내과', category: 'hospital',
      roadAddress: '경기도 화성시 병점노을4로 29',
      extras: { clCdNm: '의원', drTotCnt: 2 },
    });
    expect(Number.isInteger(item.distance)).toBe(true);
    expect(item.distance).toBeGreaterThanOrEqual(119);
    expect(item.distance).toBeLessThanOrEqual(121);
  });

  it('같은 이름+좌표 중복 등록은 하나로 접는다', async () => {
    db.toilet = [row('me', '공원화장실', 0)];
    db.park = [row('k1', '가람공원', 200), row('k2', '가람공원', 200), row('k3', '하늘공원', 400)];
    const result = await nearbyGroupedForFacility('toilet', 'me', 5);
    const park = result!.groups.find((g) => g.category === 'park')!;
    expect(park.items.map((i) => i.name)).toEqual(['가람공원', '하늘공원']);
  });

  it('ev-charger 관련 카테고리는 충전소 단위 검색을 반경 1km 로 쓰고 count 는 그 total', async () => {
    db.parking = [row('me', '공영주차장', 0)];
    mockStationSearch.mockResolvedValue({
      items: [station('s1', 100), station('s2', 200), station('s3', 300)], total: 3, page: 1, totalPages: 1,
    });
    const result = await nearbyGroupedForFacility('parking', 'me', 2);
    const ev = result!.groups.find((g) => g.category === 'ev-charger')!;
    expect(mockStationSearch).toHaveBeenCalledWith(expect.objectContaining({ lat: CENTER.lat, lng: CENTER.lng, radius: 1000, page: 1 }));
    expect(ev.count).toBe(3);
    expect(ev.exact).toBe(true);
    expect(ev.items.map((i) => i.id)).toEqual(['s1', 's2']);
    expect(ev.items[0].extras).toEqual({ rapidCount: 2, slowCount: 4 });
  });

  it('현재 카테고리가 ev-charger 면 첫 충전기 좌표를 가볍게 읽고 자기 충전소(statId)를 뺀다', async () => {
    db.evCharger = [
      { ...row('c2', '충전소', 0), statId: 'ME01', chgerId: '02', lat: 37.6 },
      { ...row('c1', '충전소', 0), statId: 'ME01', chgerId: '01' },
    ];
    mockStationSearch.mockResolvedValue({
      items: [station('ME01', 0), station('s2', 200)], total: 2, page: 1, totalPages: 1,
    });
    const result = await nearbyGroupedForFacility('ev-charger', 'ME01', 5);
    expect(mockStationSearch).toHaveBeenCalledWith(expect.objectContaining({ lat: CENTER.lat, lng: CENTER.lng }));
    expect(result!.groups[0]).toMatchObject({ category: 'ev-charger', count: 1 });
    expect(result!.groups[0].items.map((i) => i.id)).toEqual(['s2']);
    expect(mockStationDetail).not.toHaveBeenCalled();
  });

  it('없는 충전소·와이파이 그룹은 null', async () => {
    expect(await nearbyGroupedForFacility('ev-charger', 'NOPE', 5)).toBeNull();
    expect(await nearbyGroupedForFacility('wifi', 'wifi-g000000000000', 5)).toBeNull();
  });

  it('wifi 는 장소 단위 검색을 쓰고, 현재가 그룹 id 면 그룹 좌표 평균을 쓰고 그 id 를 뺀다', async () => {
    db.wifi = [
      { ...row('wifi-111111111111', '병점도서관', 0), groupId: 'wifi-g0123456789ab', lat: 37.499 },
      { ...row('wifi-222222222222', '병점도서관', 0), groupId: 'wifi-g0123456789ab', lat: 37.501 },
    ];
    mockWifiSearch.mockResolvedValue({
      items: [wifiGroup('wifi-g0123456789ab', 0), wifiGroup('wifi-gaaaaaaaaaaaa', 150)], total: 2, page: 1, totalPages: 1,
    });
    const result = await nearbyGroupedForFacility('wifi', 'wifi-g0123456789ab', 5);
    const call = mockWifiSearch.mock.calls[0][0];
    expect(call).toMatchObject({ radius: 1000, page: 1, lng: CENTER.lng });
    expect(call.lat).toBeCloseTo(37.5, 6);
    expect(result!.groups[0]).toMatchObject({ category: 'wifi', count: 1 });
    expect(result!.groups[0].items.map((i) => i.id)).toEqual(['wifi-gaaaaaaaaaaaa']);
    expect(result!.groups[0].items[0].extras).toEqual({ installLocation: '1층 로비' });
    expect(mockWifiGroupDetail).not.toHaveBeenCalled();
  });

  it('옛 wifi AP 상세면 그룹 키 COALESCE(groupId, id) 로 자기를 뺀다', async () => {
    // groupId 가 있는 AP → 그 그룹 id 를 뺀다
    db.wifi = [{ ...row('wifi-0123456789ab', '병점도서관', 0), groupId: 'wifi-gcccccccccccc' }];
    mockWifiSearch.mockResolvedValue({
      items: [wifiGroup('wifi-gcccccccccccc', 30), wifiGroup('wifi-gbbbbbbbbbbbb', 150)], total: 2, page: 1, totalPages: 1,
    });
    let result = await nearbyGroupedForFacility('wifi', 'wifi-0123456789ab', 5);
    expect(result!.groups[0].count).toBe(1);
    expect(result!.groups[0].items.map((i) => i.id)).toEqual(['wifi-gbbbbbbbbbbbb']);

    // groupId 가 NULL 인 AP → 그룹 키가 자기 id 다
    db.wifi = [{ ...row('wifi-0123456789ab', '병점도서관', 0), groupId: null }];
    mockWifiSearch.mockResolvedValue({
      items: [wifiGroup('wifi-0123456789ab', 0), wifiGroup('wifi-gbbbbbbbbbbbb', 150)], total: 2, page: 1, totalPages: 1,
    });
    result = await nearbyGroupedForFacility('wifi', 'wifi-0123456789ab', 5);
    expect(result!.groups[0].count).toBe(1);
    expect(result!.groups[0].items.map((i) => i.id)).toEqual(['wifi-gbbbbbbbbbbbb']);
  });

  it('자기와 이름+좌표가 같은 원본 중복 레코드는 목록에서 뺀다(count 는 #944 와 같이 dedupe 전 수)', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0), row('dup', '캐슬약국', 0), row('p2', '온누리약국', 300)];
    const result = await nearbyGroupedForFacility('pharmacy', 'me', 5);
    expect(result!.groups[0].items.map((i) => i.id)).toEqual(['p2']);
    expect(result!.groups[0].count).toBe(2);
  });

  it('어떤 카테고리에서도 조회수를 올리지 않는다', async () => {
    db.pharmacy = [row('me', '캐슬약국', 0)];
    db.evCharger = [{ ...row('c1', '충전소', 0), statId: 'ME01', chgerId: '01' }];
    db.wifi = [
      { ...row('wifi-111111111111', '도서관', 0), groupId: 'wifi-g0123456789ab' },
      { ...row('wifi-0123456789ab', '병점도서관', 0), groupId: null },
    ];
    await nearbyGroupedForFacility('pharmacy', 'me', 5);
    await nearbyGroupedForFacility('ev-charger', 'ME01', 5);
    await nearbyGroupedForFacility('wifi', 'wifi-g0123456789ab', 5);
    await nearbyGroupedForFacility('wifi', 'wifi-0123456789ab', 5);
    expect(mockBufferView).not.toHaveBeenCalled();
    expect(mockStationDetail).not.toHaveBeenCalled();
    expect(mockWifiGroupDetail).not.toHaveBeenCalled();
  });
});
