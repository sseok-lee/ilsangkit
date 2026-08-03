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
export async function fetchBuildings(
  type: string,
  bounds: Bounds,
): Promise<{ items: MapBuildingItem[]; total: number; exact: boolean }> {
  assertKnownType(type);

  const where = `type = ? AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`;
  const params = [type, bounds.swLat, bounds.neLat, bounds.swLng, bounds.neLng];

  const countRows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
    `SELECT COUNT(*) AS cnt FROM RealEstateBuildingSummary
     FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
     WHERE ${where}`,
    ...params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT buildingName, city, district, dongName, lat, lng,
            latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay,
            transactionCount
     FROM RealEstateBuildingSummary
     FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
     WHERE ${where}
     ORDER BY transactionCount DESC
     LIMIT ${BUILDING_LIMIT}`,
    ...params,
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

export type RegionLevel = 'city' | 'district';

export interface MapRegionItem {
  /** level='city' 면 시/도명, 'district' 면 시/도명 (district 필드와 짝) */
  name: string;
  district: string | null;
  lat: number;
  lng: number;
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
  const groupCols = level === 'city' ? 't.city' : 't.city, t.district';
  const selectName =
    level === 'city'
      ? 't.city AS name, NULL AS district'
      : 't.city AS name, t.district AS district';
  const joinCoord =
    level === 'city'
      ? `JOIN (SELECT city, AVG(lat) AS lat, AVG(lng) AS lng FROM Region GROUP BY city) r
           ON r.city = t.city`
      : `JOIN Region r ON r.city = t.city AND r.district = t.district`;

  const sql = `
    SELECT ${selectName},
           r.lat AS lat, r.lng AS lng,
           ROUND(AVG(t.${priceCol} / (t.exclusiveArea / ${PYEONG_M2}))) AS avgPricePerPyeong,
           COUNT(*) AS transactionCount
    FROM ${table} t
    ${joinCoord}
    WHERE t.exclusiveArea > 0 ${rentFilter} AND ${dateSql}
    GROUP BY ${groupCols}, r.lat, r.lng
  `;

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...dateParams);

  return rows.map((r) => ({
    name: String(r.name),
    district: r.district == null ? null : String(r.district),
    lat: Number(r.lat),
    lng: Number(r.lng),
    avgPricePerPyeong: r.avgPricePerPyeong == null ? null : Number(r.avgPricePerPyeong),
    transactionCount: Number(r.transactionCount ?? 0),
  }));
}

/**
 * 지역 단위 평균 평당가. 뷰포트와 무관하므로 (type, level) 조합 12개만 캐시하면 전부 커버된다.
 *
 * 실패 시 빈 배열을 주고 **캐시하지 않는다**. 호출부(SSR)는 지역 링크를 상수에서 만들고
 * 가격만 이 값으로 채우므로, 빈 배열이어도 페이지는 링크를 온전히 렌더한다(fail-open).
 */
export async function fetchRegions(type: string, level: RegionLevel): Promise<MapRegionItem[]> {
  const key = `${type}:${level}`;
  const hit = regionCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const pending = regionInFlight.get(key);
  if (pending) return pending;

  const task = buildRegions(type, level)
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

  regionInFlight.set(key, task);
  return task;
}
