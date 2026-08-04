import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, serializeRow } from './realEstateService.js';
import { recentMonthsCondition } from '../lib/sargableDate.js';

/** 건물 마커 상한. 카카오 CustomOverlay 는 DOM 노드라 이 이상은 렌더가 무겁다. */
export const BUILDING_LIMIT = 200;

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface MapBuildingItem {
  buildingName: string;
  city: string;
  district: string;
  dongName: string;
  lat: number | null;
  lng: number | null;
  /** 매매=거래금액, 전월세=보증금 (만원) */
  latestPrice: number | null;
  /** null=매매 / 0=전세 / >0=월세 */
  monthlyRent: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  latestDealDay: number | null;
  transactionCount: number;
}

function assertKnownType(type: string): void {
  if (!TABLE_NAME_MAP[type]) throw new Error(`Unknown real estate type: ${type}`);
}

/**
 * 뷰포트(bbox) 안의 건물을 거래량 순으로 가져온다.
 *
 * ⚠️ FORCE INDEX 가 핵심이다. 이 힌트가 없으면 MySQL 이 ORDER BY transactionCount DESC
 * 때문에 type_transactionCount_idx 역방향 스캔을 고르는데, 희소 뷰포트에서 16만 행을
 * 훑고 2건을 찾는다. 실측 232ms vs 11ms (21배). 운영 baseline 은 그 약 2배다.
 *
 * total 은 items.length 가 아니라 별도 COUNT 다. 목록을 개수 용도로 재사용하면
 * "반경 1km 병원 893곳을 6곳으로" 렌더하던 2026-08 버그가 재발한다.
 */
/** Prisma 인덱스명. FORCE INDEX 가 문자열로 참조하므로 스키마의 @@index([type, lat, lng]) 와 묶여 있다. */
const COORD_INDEX = 'RealEstateBuildingSummary_type_lat_lng_idx';
const INDEX_HINT = ` FORCE INDEX (${COORD_INDEX})`;

/** MySQL 1176 = ER_KEY_DOES_NOT_EXIST. 힌트가 가리키는 인덱스가 없을 때 난다. */
function isMissingIndexError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('1176') || msg.includes("doesn't exist in table");
}

let warnedMissingIndex = false;

/**
 * FORCE INDEX 를 걸어 실행하고, 인덱스가 없으면 힌트 없이 재시도한다.
 *
 * 힌트가 없으면 옵티마이저가 transactionCount 역방향 스캔을 골라 16배 느려지지만(실측
 * 357ms vs 22ms), 그건 느린 것이지 죽은 게 아니다. 반면 인덱스가 없는 상태에서 FORCE INDEX
 * 는 쿼리 자체가 에러(1176)라 부동산 허브의 지도가 통째로 500 을 낸다.
 *
 * 배포는 `prisma db push` 를 pm2 restart 앞에 돌리므로 정상 경로에서는 인덱스가 먼저 생긴다.
 * 이 폴백은 그게 실패했거나 DB 를 롤백·복원한 경우를 위한 것이다 — 조용히 넘어가지 않도록
 * 경고를 남긴다(프로세스당 1회, 로그 폭주 방지).
 */
async function queryWithIndexHint<T>(
  build: (hint: string) => string,
  params: unknown[],
): Promise<T[]> {
  try {
    return await prisma.$queryRawUnsafe<T[]>(build(INDEX_HINT), ...params);
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    if (!warnedMissingIndex) {
      warnedMissingIndex = true;
      console.warn(
        `[realEstateMap] ${COORD_INDEX} 가 없어 힌트 없이 폴백합니다 — 뷰포트 조회가 크게 느려집니다. ` +
          'prisma db push 가 적용됐는지 확인하세요.',
      );
    }
    return await prisma.$queryRawUnsafe<T[]>(build(''), ...params);
  }
}

export function __resetIndexWarningForTest(): void {
  warnedMissingIndex = false;
}

export async function fetchBuildings(
  type: string,
  bounds: Bounds,
): Promise<{ items: MapBuildingItem[]; total: number; exact: boolean }> {
  assertKnownType(type);

  const where = `type = ? AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`;
  const params = [type, bounds.swLat, bounds.neLat, bounds.swLng, bounds.neLng];

  const countRows = await queryWithIndexHint<{ cnt: bigint | number }>(
    (hint) => `SELECT COUNT(*) AS cnt FROM RealEstateBuildingSummary${hint}
     WHERE ${where}`,
    params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  const rows = await queryWithIndexHint<Record<string, unknown>>(
    (hint) => `SELECT buildingName, city, district, dongName, lat, lng,
            latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay,
            transactionCount
     FROM RealEstateBuildingSummary${hint}
     WHERE ${where}
     ORDER BY transactionCount DESC
     LIMIT ${BUILDING_LIMIT}`,
    params,
  );

  const items = rows.map((r) => {
    const s = serializeRow(r) as Record<string, unknown>;
    return {
      ...s,
      lat: s.lat == null ? null : Number(s.lat),
      lng: s.lng == null ? null : Number(s.lng),
    } as MapBuildingItem;
  });

  return { items, total, exact: total <= BUILDING_LIMIT };
}

// ─────────────────────────────────────────────
// 지역 집계
// ─────────────────────────────────────────────

export type RegionLevel = 'city' | 'district' | 'dong';

export interface MapRegionItem {
  /** 항상 시/도명. district/dong 필드와 짝을 이뤄 단위를 표현한다. */
  name: string;
  district: string | null;
  /** level='dong' 일 때만 채워진다. city/district 에서는 null. */
  dong: string | null;
  /**
   * Region.lat/lng 는 스키마상 NOT NULL 이라 실제로는 항상 채워진다. 그래도
   * fetchBuildings/MapBuildingItem 과 같은 규약(널을 0 으로 뭉개 좌표를 조작하지
   * 않는다)을 따르기 위해 nullable 로 선언한다 — bbox 필터(isInBounds)가 null 을
   * "좌표 없음"으로 명시적으로 제외할 수 있게 한다.
   */
  lat: number | null;
  lng: number | null;
  /** 평당가(만원). 해당 기간 거래가 없으면 null */
  avgPricePerPyeong: number | null;
  transactionCount: number;
}

/** 집계 대상 기간. 최근 3개월. */
const AGGREGATE_MONTHS = 3;
/** 1평 = 3.3058㎡ */
const PYEONG_M2 = 3.3058;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const regionCache = new Map<string, { value: MapRegionItem[]; expiresAt: number }>();
const regionInFlight = new Map<string, Promise<MapRegionItem[]>>();

export function __resetMapCacheForTest(): void {
  regionCache.clear();
  regionInFlight.clear();
}

async function buildRegions(type: string, level: RegionLevel): Promise<MapRegionItem[]> {
  assertKnownType(type);
  const table = TABLE_NAME_MAP[type];
  const isRent = type.endsWith('-rent');

  // 전월세는 보증금(deposit) 기준이고 **전세만** 집계한다. 월세 보증금과 전세 보증금은
  // 규모가 달라 섞으면 지역 평균이 무의미해진다. monthlyRent=0 이 전세다(NULL 아님).
  const priceCol = isRent ? 'deposit' : 'dealAmount';
  const rentFilter = isRent ? 'AND t.monthlyRent = 0' : '';

  const { sql: dateSql, params: dateParams } = recentMonthsCondition(AGGREGATE_MONTHS, new Date());

  // 좌표는 Region(구·군 267행)에서 가져온다. 시/도는 그 평균을 중심으로 쓴다.
  // 시/도 상수를 새로 만들지 않는 이유: 행정구역 개편(2026-07 전남광주통합)마다
  // 하드코딩 맵이 드리프트해 404 를 냈던 이력이 있다.
  //
  // 동은 좌표 출처가 다르다. Region 테이블은 @@unique([city, district]) 라 동이 없어
  // JOIN 하면 0행이 된다 — 거래 좌표의 평균을 중심으로 쓴다. 거래의 99.9% 가 좌표를
  // 갖고 있어(2026-08 운영 실측) 평균이 안정적이다.
  const isDong = level === 'dong';

  const groupCols = isDong
    ? 't.city, t.district, t.dongName'
    : level === 'city'
      ? 't.city'
      : 't.city, t.district';

  const selectName = isDong
    ? 't.city AS name, t.district AS district, t.dongName AS dong'
    : level === 'city'
      ? 't.city AS name, NULL AS district, NULL AS dong'
      : 't.city AS name, t.district AS district, NULL AS dong';

  const joinCoord = isDong
    ? ''
    : level === 'city'
      ? `JOIN (SELECT city, AVG(lat) AS lat, AVG(lng) AS lng FROM Region GROUP BY city) r
           ON r.city = t.city`
      : `JOIN Region r ON r.city = t.city AND r.district = t.district`;

  // 좌표 컬럼과 GROUP BY 꼬리가 동/그 외에서 다르다. 동은 집계 함수라 GROUP BY 에
  // 넣지 않고, 그 외는 JOIN 으로 가져온 상수라 GROUP BY 에 넣어야 한다.
  const coordCols = isDong ? 'AVG(t.lat) AS lat, AVG(t.lng) AS lng' : 'r.lat AS lat, r.lng AS lng';
  const groupTail = isDong ? '' : ', r.lat, r.lng';

  // 좌표 없는 거래(0.1%)가 AVG 에 섞이면 동 중심이 흔들린다. 동일 때만 건다 —
  // city/district 는 좌표를 Region 에서 가져오므로 거래 좌표와 무관하다.
  const coordFilter = isDong ? 'AND t.lat IS NOT NULL AND t.lng IS NOT NULL' : '';

  const sql = `
    SELECT ${selectName},
           ${coordCols},
           ROUND(AVG(t.${priceCol} / (t.exclusiveArea / ${PYEONG_M2}))) AS avgPricePerPyeong,
           COUNT(*) AS transactionCount
    FROM ${table} t
    ${joinCoord}
    WHERE t.exclusiveArea > 0 ${rentFilter} ${coordFilter} AND ${dateSql}
    GROUP BY ${groupCols}${groupTail}
  `;

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...dateParams);

  return rows.map((r) => ({
    name: String(r.name),
    district: r.district == null ? null : String(r.district),
    dong: r.dong == null ? null : String(r.dong),
    // null 을 Number() 에 그대로 넘기면 0 이 되어 (0,0) 좌표로 둔갑한다 — bbox 필터가
    // "진짜 (0,0)"과 "좌표 없음"을 구분 못 하게 되므로 null 은 null 로 보존한다.
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    avgPricePerPyeong: r.avgPricePerPyeong == null ? null : Number(r.avgPricePerPyeong),
    transactionCount: Number(r.transactionCount ?? 0),
  }));
}

/**
 * 지역 항목이 뷰포트(bbox) 안에 있는지 판정한다. fetchBuildings 의 `BETWEEN` 과 동일하게
 * 양끝 포함(inclusive)이다 — 뷰포트 경계에 걸친 항목이 building/region 조회에서
 * 다르게 취급되면 안 된다.
 *
 * Region.lat/lng 는 스키마상 NOT NULL Decimal 이라 buildRegions 의 결과가 null 좌표를
 * 낼 일은 현재 없다. 그래도 raw SQL + JOIN 결과를 다루는 코드라 향후 JOIN 이 바뀌거나
 * (예: LEFT JOIN) 예상과 다른 행이 섞이면 null/NaN 이 들어올 수 있다 — 그런 항목은
 * 지도에 찍을 좌표가 없어 "뷰포트 안"이라고 판단할 근거가 없으므로, 크래시 대신
 * 필터에서 조용히 제외한다(fail-safe, 전체 목록이 아니라 항목 하나만 누락).
 */
function isInBounds(item: MapRegionItem, bounds: Bounds): boolean {
  const { lat, lng } = item;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= bounds.swLat && lat <= bounds.neLat && lng >= bounds.swLng && lng <= bounds.neLng;
}

/** 지역 목록을 뷰포트로 좁힌다. 캐시에는 절대 이 결과가 아니라 원본(전국) 목록만 저장한다. */
function filterRegionsByBounds(items: MapRegionItem[], bounds: Bounds): MapRegionItem[] {
  return items.filter((item) => isInBounds(item, bounds));
}

interface Point {
  lat: number;
  lng: number;
}

/** bbox 중심점. 요청마다 달라지므로 캐시 키에 넣지 않고(전국 목록만 캐시) 매 호출 시 계산한다. */
function boundsCenter(bounds: Bounds): Point {
  return { lat: (bounds.swLat + bounds.neLat) / 2, lng: (bounds.swLng + bounds.neLng) / 2 };
}

/**
 * 중심점까지의 유클리드 거리 제곱(정렬 전용 — 표시용 실거리가 아니므로 sqrt 를 생략한다).
 * 위경도 평면 근사라 지오데식으로는 부정확하지만, 단일 뷰포트 안의 표시 우선순위를
 * 매기는 용도라 문제 없다(팀리드 지시).
 *
 * 좌표가 null 인 항목은 +Infinity 를 줘 항상 맨 뒤로 보낸다 — 정상 흐름에서는
 * filterRegionsByBounds(isInBounds) 가 null 좌표 항목을 이미 걸러내므로 이 분기는 실제로는
 * 타지 않는다. 그래도 이 함수가 필터를 거치지 않은 목록에 단독으로 호출될 가능성(테스트,
 * 향후 호출부 변경)에 대비한 방어 코드다 — null 을 (0,0) 처럼 취급해 "중심에서 제일 가까움"
 * 으로 둔갑시키면 좌표 없는 항목이 라벨 우선순위 1번을 차지하는 사고가 나므로, 크래시도
 * 앞자리 승격도 아닌 "결정론적으로 맨 뒤" 를 택한다.
 */
function squaredDistanceToCenter(item: MapRegionItem, center: Point): number {
  const { lat, lng } = item;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  const dLat = lat - center.lat;
  const dLng = lng - center.lng;
  return dLat * dLat + dLng * dLng;
}

/** null 을 빈 문자열로 취급해 앞쪽에 오게 한다 — 동렬 tiebreak 전용이라 표시 순서와는 무관하다. */
function compareNullableString(a: string | null, b: string | null): number {
  const av = a ?? '';
  const bv = b ?? '';
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

/**
 * 거리가 동률일 때(부동소수 연산이라 실제로도 벌어진다 — 예: 시/도 레벨에서 Region 평균
 * 좌표가 우연히 같은 경우)의 결정론적 타이브레이크. name → district → dong 순으로 비교한다.
 * 이게 없으면 Array.prototype.sort 가 엔진/노드 버전에 따라 동률 항목의 상대 순서를 다르게
 * 낼 수 있어(구현별 정렬 안정성 차이), 같은 요청이 응답마다 다른 순서로 돌아와 지도 라벨이
 * 리렌더마다 재배치되는 것처럼 보인다.
 */
function compareRegionsTiebreak(a: MapRegionItem, b: MapRegionItem): number {
  return (
    compareNullableString(a.name, b.name) ||
    compareNullableString(a.district, b.district) ||
    compareNullableString(a.dong, b.dong)
  );
}

/**
 * 지역 목록을 요청 bbox 중심에서 가까운 순으로 정렬한다.
 *
 * 반드시 bbox 필터 뒤·캐시에서 꺼낸 뒤에 호출한다 — 캐시는 (type, level) 전국 목록만
 * 들고 있고, 정렬 기준(중심점)은 요청마다 다르기 때문이다. 정렬된 결과를 캐시에 넣으면
 * 다음 요청이 엉뚱한 중심 기준 순서를 그대로 돌려받는다.
 *
 * 이 순서가 곧 지도 라벨 우선순위다(useMapOverlays 가 items 순서대로 그리고 겹치면 뒤엣것을
 * 점으로 접는다) — 클릭한 지역과 가장 가까운 동/구·군이 라벨을 차지하는 게 의도된 결과다.
 */
export function sortRegionsByDistance(items: MapRegionItem[], bounds: Bounds): MapRegionItem[] {
  const center = boundsCenter(bounds);
  return [...items].sort((a, b) => {
    const da = squaredDistanceToCenter(a, center);
    const db = squaredDistanceToCenter(b, center);
    // da - db 로 뺄셈하지 않는다: 좌표 없는 두 항목을 비교하면 Infinity - Infinity = NaN 이
    // 되어 정렬 결과가 정의되지 않는다. 값 비교로 -1/0/1 을 직접 낸다.
    if (da !== db) return da < db ? -1 : 1;
    return compareRegionsTiebreak(a, b);
  });
}

/** bbox 필터 + 중심점 정렬을 한 번에 적용한다. fetchRegions 의 캐시 히트/미스 두 경로가 공유한다. */
function filterAndSortRegions(items: MapRegionItem[], bounds: Bounds): MapRegionItem[] {
  return sortRegionsByDistance(filterRegionsByBounds(items, bounds), bounds);
}

/**
 * 지역 단위 평균 평당가 — 요청 뷰포트(bbox)로 필터링해 반환한다.
 *
 * 캐시/in-flight dedup 은 (type, level) 조합 18개(6 타입 × 3 레벨)만 커버하면 되므로 **전국 목록**을
 * 그대로 유지한다(뷰포트를 캐시 키에 넣으면 뷰포트는 무한하므로 캐시가 무한정 커진다).
 * bbox 필터는 캐시에서 꺼낸 뒤 매 호출마다 메모리에서 적용한다 — 지역 수가 적어
 * (구·군 267 + 시/도 16) 비용이 무시할 만하다.
 *
 * 실패 시 빈 배열을 주고 **캐시하지 않는다**. 호출부(SSR)는 지역 링크를 상수에서 만들고
 * 가격만 이 값으로 채우므로, 빈 배열이어도 페이지는 링크를 온전히 렌더한다(fail-open).
 */
export async function fetchRegions(
  type: string,
  level: RegionLevel,
  bounds: Bounds,
): Promise<MapRegionItem[]> {
  const key = `${type}:${level}`;
  const hit = regionCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return filterAndSortRegions(hit.value, bounds);

  let pending = regionInFlight.get(key);
  if (!pending) {
    pending = buildRegions(type, level)
      .then((value) => {
        regionCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
      })
      .catch((err) => {
        console.warn(`[realEstateMap] region aggregate failed (${key}):`, err);
        return [] as MapRegionItem[];
      })
      .finally(() => {
        regionInFlight.delete(key);
      });
    regionInFlight.set(key, pending);
  }

  const value = await pending;
  return filterAndSortRegions(value, bounds);
}
