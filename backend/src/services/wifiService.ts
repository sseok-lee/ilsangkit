/**
 * wifi 장소 단위(그룹) 조회 서비스.
 *
 * ev-charger 가 statId 로 충전소를 접는 것과 같은 역할을 wifi 에서 한다.
 * 그룹 키의 근거와 주의점은 [[wifiGroup.ts]] 주석 참조.
 */
import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, SHORT_TO_SLUG, FULL_TO_SLUG } from './cityMapping.js';
import { canUseFulltext, toBooleanPhrase } from './search/fulltextKeyword.js';
import { bufferViewCount } from './viewCountService.js';
import { isWifiGroupId } from './wifiGroup.js';

/**
 * 장소 단위 그룹 키 SQL 식.
 *
 * groupId 가 NULL 인 행(스키마만 배포되고 백필 전)을 그대로 GROUP BY 하면 SQL 의 NULL 이
 * 한 그룹으로 뭉쳐서 전국 wifi 가 페이지 하나로 접힌다. COALESCE 로 자기 id 에 떨어뜨려
 * 백필 전에는 종전처럼 AP 단위로 동작하게 한다(fail-open).
 */
const GROUP_KEY_SQL = 'COALESCE(groupId, id)';

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface WifiAccessPoint {
  id: string;
  lat: number;
  lng: number;
  ssid: string | null;
  installLocation: string | null;
  installLocationDetail: string | null;
}

interface FacilityDetail {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  bjdCode: string | null;
  details: Record<string, unknown>;
  sourceId: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

/** 그룹 내 SSID 를 중복 제거해 합친다. 빈 값은 버린다. */
function mergeSsid(rows: { ssid: string | null }[]): string | null {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = (r.ssid ?? '').trim();
    if (v) seen.add(v);
  }
  return seen.size > 0 ? [...seen].join(', ') : null;
}

/**
 * wifi 장소 상세 조회 — 그룹에 속한 AP 를 모두 실어 반환한다.
 *
 * 대표 좌표는 AP 들의 중심점이다. 첫 AP 를 쓰면 '버스정류장'(반경 29km) 같은
 * 넓은 그룹에서 지도 중심이 한쪽 끝에 붙어 나머지 핀이 화면 밖으로 나간다.
 */
export async function getWifiGroupDetail(groupId: string): Promise<FacilityDetail | null> {
  // 그룹 id 형식이 아니면 조회 자체를 하지 않는다 — AP id 가 흘러들어와
  // groupId 컬럼 풀스캔이 되는 것을 막는다.
  if (!isWifiGroupId(groupId)) return null;

  const rows = await prisma.wifi.findMany({
    where: { groupId },
    orderBy: { id: 'asc' },
  });
  if (rows.length === 0) return null;

  const first = rows[0];

  // 조회수는 대표 행에 누적한다 (ev-charger 가 first.id 에 누적하는 것과 동일)
  bufferViewCount('wifi', first.id);

  const located = rows.filter((r) => r.lat != null && r.lng != null);
  const accessPoints: WifiAccessPoint[] = located.map((r) => ({
    id: r.id,
    lat: Number(r.lat),
    lng: Number(r.lng),
    ssid: r.ssid,
    installLocation: r.installLocation,
    installLocationDetail: r.installLocationDetail,
  }));

  const centerLat = located.length
    ? located.reduce((s, r) => s + Number(r.lat), 0) / located.length
    : 0;
  const centerLng = located.length
    ? located.reduce((s, r) => s + Number(r.lng), 0) / located.length
    : 0;

  return {
    id: groupId,
    category: 'wifi' as FacilityCategory,
    name: first.name,
    address: first.address,
    roadAddress: first.roadAddress,
    lat: centerLat,
    lng: centerLng,
    city: first.city,
    district: first.district,
    bjdCode: first.bjdCode,
    details: {
      ssid: mergeSsid(rows),
      installDate: first.installDate,
      serviceProvider: first.serviceProvider,
      installLocation: first.installLocation,
      installLocationDetail: first.installLocationDetail,
      managementAgency: first.managementAgency,
      phoneNumber: first.phoneNumber,
      govCode: first.govCode,
      dataDate: first.dataDate,
      // AP 총 개수는 좌표 없는 행까지 포함한 실제 행 수다 —
      // 핀 개수(accessPoints.length)와 다를 수 있다.
      accessPointCount: rows.length,
      accessPoints,
    },
    sourceId: first.sourceId,
    sourceUrl: first.sourceUrl,
    viewCount: first.viewCount,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    syncedAt: first.syncedAt,
  };
}

interface FacilityItem {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  distance?: number;
  extras?: Record<string, unknown>;
}

/**
 * wifi 장소 단위 검색 — ev-charger 가 statId 로 충전소를 접는 것과 같은 역할.
 *
 * 이 함수가 없으면 목록·주변 시설이 AP 행 단위로 나온다. 상세는 "AP 154대가 한 장소"
 * 라고 말하는데 주변 시설에는 같은 장소가 4개씩 뜨고, 지역 목록의 "405곳"도 장소 수가
 * 아니라 AP 수가 된다.
 *
 * Prisma 의 groupBy/distinct 는 앱 메모리 처리라 14만 행에서 위험하다
 * (과거 지오코딩 OOM 2.07GB 와 같은 패턴). DB 안에서 GROUP BY 로 접는다.
 */
export async function wifiGroupSearch(params: {
  keyword?: string; city?: string; district?: string;
  lat?: number; lng?: number; radius?: number;
  swLat?: number; swLng?: number; neLat?: number; neLng?: number;
  page: number; limit: number;
}): Promise<{ items: FacilityItem[]; total: number; page: number; totalPages: number }> {
  const { keyword, city, district, lat, lng, radius, swLat, swLng, neLat, neLng, page, limit } = params;
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];

  if (keyword) {
    if (canUseFulltext(keyword)) {
      conditions.push('MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)');
      values.push(toBooleanPhrase(keyword));
    } else {
      conditions.push('(name LIKE ? OR address LIKE ? OR roadAddress LIKE ?)');
      values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
  }
  if (city) {
    // DB 에 서울/서울특별시가 혼재한다 — 양쪽 다 매칭해야 지역 필터가 샌다
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    const variants = slug
      ? [...new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean))]
      : [city];
    if (variants.length > 1) {
      conditions.push(`city IN (${variants.map(() => '?').join(', ')})`);
      values.push(...variants);
    } else {
      conditions.push('city = ?');
      values.push(city);
    }
  }
  if (district) { conditions.push('district = ?'); values.push(district); }

  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const radiusKm = radius / 1000;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
    conditions.push('lat BETWEEN ? AND ?');
    values.push(lat - latDelta, lat + latDelta);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(lng - lngDelta, lng + lngDelta);
  }
  if (swLat !== undefined && swLng !== undefined && neLat !== undefined && neLng !== undefined) {
    conditions.push('lat BETWEEN ? AND ?');
    values.push(swLat, neLat);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(swLng, neLng);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  // 서브쿼리 DISTINCT 형태 — evChargerStationSearch 와 같은 이유다(옵티마이저가
  // COUNT(DISTINCT ...) 직접형에서 loose index scan 을 고집한다).
  const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: number | bigint }>>(
    `SELECT COUNT(*) as cnt FROM (SELECT DISTINCT ${GROUP_KEY_SQL} AS g FROM Wifi WHERE ${whereClause}) t`,
    ...values,
  );
  const total = Number(countResult[0]?.cnt || 0);

  // 좌표 검색이면 이름순 LIMIT/OFFSET 으로 미리 자르면 안 된다.
  // 거리 정렬은 앱에서 하므로, 이름순으로 먼저 limit 건만 가져오면 정작 가장 가까운 곳이
  // 잘려 나간다 — 실제로 서울식물원 좌표로 조회했는데 자기 자신이 빠지고 636m 짜리부터
  // 나왔다('가'로 시작하는 이름들이 limit 을 채워버렸다).
  // 바운딩박스가 이미 범위를 좁히므로 상한만 걸고 전부 가져와 거리로 자른다.
  const isGeoSearch = lat !== undefined && lng !== undefined && radius !== undefined;
  const GEO_SCAN_CAP = 500;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${GROUP_KEY_SQL} AS groupKey,
            MIN(name) as name, MIN(address) as address, MIN(roadAddress) as roadAddress,
            AVG(lat) as lat, AVG(lng) as lng, MIN(city) as city, MIN(district) as district,
            MIN(ssid) as ssid, MIN(installLocation) as installLocation,
            COUNT(*) as accessPointCount
     FROM Wifi WHERE ${whereClause}
     GROUP BY ${GROUP_KEY_SQL} ORDER BY name ASC ${isGeoSearch ? 'LIMIT ?' : 'LIMIT ? OFFSET ?'}`,
    ...values, ...(isGeoSearch ? [GEO_SCAN_CAP] : [limit, offset]),
  );

  let items: FacilityItem[] = rows.map((r) => ({
    id: String(r.groupKey ?? ''),
    category: 'wifi' as FacilityCategory,
    name: String(r.name ?? ''),
    address: (r.address as string) ?? null,
    roadAddress: (r.roadAddress as string) ?? null,
    // 대표 좌표는 AP 들의 중심점(AVG) — 상세의 대표 좌표와 같은 규칙
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
    city: String(r.city ?? ''),
    district: String(r.district ?? ''),
    extras: {
      ssid: r.ssid ?? null,
      installLocation: r.installLocation ?? null,
      accessPointCount: Number(r.accessPointCount),
    },
  }));

  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    items = items
      .map((item) => ({ ...item, distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000) }))
      .filter((item) => item.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);
    return { items: items.slice(0, limit), total: items.length, page, totalPages: Math.ceil(items.length / limit) };
  }

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * 지역 통계용 장소 수. 다른 카테고리의 `model.count()` 자리를 대신한다.
 *
 * wifi 만 카운트 규칙이 다른 이유는 원본이 AP 1대=1행이라서다. 그대로 세면
 * 지역 허브에 "무료와이파이 141,107" 처럼 장소 수가 아니라 AP 수가 나온다.
 */
export async function countWifiGroups(cityVariants: string[], district?: string): Promise<number> {
  const conditions = [`city IN (${cityVariants.map(() => '?').join(', ')})`];
  const values: unknown[] = [...cityVariants];
  if (district) { conditions.push('district = ?'); values.push(district); }

  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: number | bigint }>>(
    `SELECT COUNT(*) as cnt FROM (SELECT DISTINCT ${GROUP_KEY_SQL} AS g FROM Wifi WHERE ${conditions.join(' AND ')}) t`,
    ...values,
  );
  return Number(rows[0]?.cnt || 0);
}

/** 구·군별 장소 수. Prisma groupBy({by:['district'], _count}) 자리를 대신한다. */
export async function countWifiGroupsByDistrict(
  cityVariants: string[],
): Promise<Array<{ district: string; count: number }>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ district: string; cnt: number | bigint }>>(
    `SELECT district, COUNT(DISTINCT ${GROUP_KEY_SQL}) as cnt
     FROM Wifi WHERE city IN (${cityVariants.map(() => '?').join(', ')})
     GROUP BY district`,
    ...cityVariants,
  );
  return rows.map((r) => ({ district: String(r.district ?? ''), count: Number(r.cnt) }));
}

/**
 * 그룹의 대표 행에서 이름·지역만 가볍게 읽는다.
 *
 * 상세(getDetail) 말고도 id 로 시설을 찾는 라우트가 있다 — naver-blog 가 그렇다.
 * 그쪽이 findUnique({ id }) 만 쓰면 그룹 id 에서 404 가 난다(실제로 그렇게 났다).
 * 전체 AP 를 읽을 필요는 없으므로 상세와 분리한다.
 */
export async function getWifiGroupHeader(
  groupId: string,
): Promise<{ id: string; name: string; city: string; district: string } | null> {
  if (!isWifiGroupId(groupId)) return null;

  return prisma.wifi.findFirst({
    where: { groupId },
    select: { id: true, name: true, city: true, district: true },
    // getWifiGroupDetail 과 같은 순서라 대표 행이 일치한다
    orderBy: { id: 'asc' },
  });
}

/**
 * 기존 AP 상세 id 가 들어오면 옮겨갈 그룹 id 를 돌려준다. 없으면 null.
 *
 * groupId 가 아직 NULL 인 행(스키마만 배포되고 백필 전)에는 null 을 준다 —
 * 그 상태에서 리다이렉트하면 존재하지 않는 그룹 URL 로 보내 404 가 된다. fail-open.
 */
export async function resolveWifiGroupRedirect(id: string): Promise<string | null> {
  // 이미 그룹 id 면 리다이렉트 대상이 아니다 (무한 리다이렉트 방지)
  if (isWifiGroupId(id)) return null;

  const row = await prisma.wifi.findUnique({
    where: { id },
    select: { groupId: true },
  });
  return row?.groupId ?? null;
}
