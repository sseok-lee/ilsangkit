/**
 * 지하철역 조회 서비스 (BBox prefilter + Haversine).
 *
 * 한국 영토(KOREA_BOUNDS lat 33-39) 가정. cos(lat) 클램프 불필요.
 */

import type { SubwayStation } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearbyStation {
  id: string;
  name: string;
  nameSlug: string;
  line: string;
  distance: number;
  type: 'subway';
}

export async function findNearbyStations(
  lat: number,
  lng: number,
  radiusM: number,
  limit = 10,
): Promise<NearbyStation[]> {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(0.01, Math.cos(toRad(lat)));

  const candidates = await prisma.subwayStation.findMany({
    where: {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    },
    select: { id: true, name: true, nameSlug: true, line: true, lat: true, lng: true },
  });

  const enriched = candidates.map((s) => {
    const sLat = typeof s.lat === 'number' ? s.lat : Number(s.lat);
    const sLng = typeof s.lng === 'number' ? s.lng : Number(s.lng);
    return {
      id: s.id,
      name: s.name,
      nameSlug: s.nameSlug,
      line: s.line,
      distance: haversine(lat, lng, sLat, sLng),
    };
  });

  return enriched
    .filter((s) => s.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      name: s.name,
      nameSlug: s.nameSlug,
      line: s.line,
      distance: Math.round(s.distance),
      type: 'subway' as const,
    }));
}

export interface SerializedStation {
  id: string;
  sourceId: string;
  name: string;
  nameSlug: string;
  line: string;
  transferLines: string[];
  operator: string | null;
  lat: number;
  lng: number;
  address: string | null;
  roadAddress: string | null;
  city: string | null;
  district: string | null;
  regionSlug: string | null;
  phoneNumber: string | null;
  dataDate: string | null;
  updatedAt: string;
}

export function serializeStation(station: SubwayStation): SerializedStation {
  let transferLines: string[] = [];
  if (station.transferLines) {
    try {
      const parsed = JSON.parse(station.transferLines);
      if (Array.isArray(parsed)) transferLines = parsed.filter((s) => typeof s === 'string');
    } catch {
      transferLines = [];
    }
  }

  return {
    id: station.id,
    sourceId: station.sourceId,
    name: station.name,
    nameSlug: station.nameSlug,
    line: station.line,
    transferLines,
    operator: station.operator,
    lat: Number(station.lat),
    lng: Number(station.lng),
    address: station.address,
    roadAddress: station.roadAddress,
    city: station.city,
    district: station.district,
    regionSlug: station.regionSlug,
    phoneNumber: station.phoneNumber,
    dataDate: station.dataDate,
    updatedAt: station.updatedAt.toISOString(),
  };
}

export async function getStationBySlug(slug: string): Promise<SubwayStation | null> {
  return prisma.subwayStation.findUnique({ where: { nameSlug: slug } });
}

export interface ListStationsParams {
  page?: number;
  limit?: number;
  line?: string;
  city?: string;
}

export async function listStations(params: ListStationsParams): Promise<{
  items: SerializedStation[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));

  const where: Record<string, unknown> = {};
  if (params.line) where.line = params.line;
  if (params.city) where.city = params.city;

  const [items, total] = await Promise.all([
    prisma.subwayStation.findMany({
      where,
      orderBy: [{ name: 'asc' }, { line: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subwayStation.count({ where }),
  ]);

  return {
    items: items.map(serializeStation),
    total,
    page,
    limit,
  };
}

export async function listStationSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await prisma.subwayStation.findMany({
    select: { nameSlug: true, updatedAt: true },
    orderBy: { nameSlug: 'asc' },
  });
  return rows.map((r) => ({ slug: r.nameSlug, updatedAt: r.updatedAt }));
}

/**
 * 환승역 그룹핑 — nameSlug 단위로 1건 응답.
 *
 * DB는 노선별 row(`sourceId = ${stationCode}-${lineCode}`)지만 응답은 역 단위.
 * 동일 좌표지만 suffix가 붙은 row(예: sicheong-line1/sicheong-line2)는 별도 그룹.
 *
 * 페이지네이션은 그룹핑 후 적용 — 한국 지하철 데이터는 ~1500 row 수준으로 작아
 * 전체 fetch + JS 집계 비용이 무시 가능. raw SQL GROUP_CONCAT 1024 byte 제한과
 * Prisma 타입 안전성 손실을 피하기 위해 의도적으로 JS 집계 채택.
 */
export interface ListStationsGroupedParams {
  page?: number;
  limit?: number;
  line?: string;
  citySlug?: string;
  district?: string;
  keyword?: string;
}

export interface SerializedStationGroup {
  id: string;
  sourceId: string;
  name: string;
  nameSlug: string;
  primaryLine: string;
  lines: string[];
  operator: string | null;
  lat: number;
  lng: number;
  address: string | null;
  roadAddress: string | null;
  city: string | null;
  district: string | null;
  regionSlug: string | null;
  phoneNumber: string | null;
  dataDate: string | null;
  updatedAt: string;
}

interface GroupAccumulator {
  primary: SubwayStation;
  lines: Set<string>;
}

/**
 * 역명 정규화 — CSV에 "가산디지털단지" / "가산디지털단지역"처럼 끝 "역" 유무가 섞여 들어오므로
 * 그룹핑 키로 사용할 때는 항상 끝의 "역"을 제거해 동일 키로 만든다.
 */
function normalizeStationName(name: string): string {
  return name.replace(/역$/, '').trim();
}

function parseTransferLinesSafe(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    // swallow — corrupt JSON ignored
  }
  return [];
}

export async function listStationsGrouped(params: ListStationsGroupedParams): Promise<{
  items: SerializedStationGroup[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  // 사이트맵에서 한 번에 전체 distinct nameSlug를 가져오기 위해 limit 상한은 라우트 Zod와 동일하게 5000.
  const limit = Math.min(5000, Math.max(1, params.limit ?? 20));

  const where: Record<string, unknown> = {};
  if (params.line) where.line = params.line;
  if (params.district) where.district = params.district;
  if (params.keyword) where.name = { contains: params.keyword };

  if (params.citySlug) {
    const slug = params.citySlug;
    const full = CITY_SLUG_TO_FULL[slug];
    const short = CITY_SLUG_TO_SHORT[slug];
    const variants = [full, short, slug].filter((v): v is string => Boolean(v));
    if (variants.length > 0) {
      where.city = { in: Array.from(new Set(variants)) };
    }
  }

  // 전체 fetch — 한국 지하철 데이터는 작아 전량 가져온 후 JS 그룹핑.
  const rows = await prisma.subwayStation.findMany({
    where,
    orderBy: [{ name: 'asc' }, { line: 'asc' }],
  });

  // (name, city, district) 단위로 그룹핑.
  // nameSlug는 slugifyStation의 충돌 회피 로직(line suffix)으로 같은 역도 다른 slug가 될 수 있어
  // 그룹핑 키로 부적합. 대신 (역명+행정구역) 조합을 키로 사용 — 서울 강남구 강남역의 2호선·신분당선
  // row가 동일 그룹이 되고, 도시·구가 다른 동명역(예: 서울 시청 vs 부산 시청)은 별도 그룹 유지.
  // 응답의 nameSlug는 그룹 내 사전순 최소값(canonical slug) — 상세 페이지 URL로 사용.
  const groups = new Map<string, GroupAccumulator>();
  for (const row of rows) {
    const normalizedName = normalizeStationName(row.name);
    const key = `${normalizedName}|${row.city ?? ''}|${row.district ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, { primary: row, lines: new Set([row.line]) });
    } else {
      const g = groups.get(key)!;
      g.lines.add(row.line);
      // primary는 line 사전순 첫 번째. 동률 시 nameSlug 사전순으로 결정(URL 안정성).
      if (row.line < g.primary.line || (row.line === g.primary.line && row.nameSlug < g.primary.nameSlug)) {
        g.primary = row;
      }
    }
    for (const tl of parseTransferLinesSafe(row.transferLines)) {
      groups.get(key)!.lines.add(tl);
    }
  }

  const allGroups: SerializedStationGroup[] = Array.from(groups.values()).map((g) => {
    const s = g.primary;
    return {
      id: s.id,
      sourceId: s.sourceId,
      name: s.name,
      nameSlug: s.nameSlug,
      primaryLine: s.line,
      lines: Array.from(g.lines).sort(),
      operator: s.operator,
      lat: Number(s.lat),
      lng: Number(s.lng),
      address: s.address,
      roadAddress: s.roadAddress,
      city: s.city,
      district: s.district,
      regionSlug: s.regionSlug,
      phoneNumber: s.phoneNumber,
      dataDate: s.dataDate,
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  allGroups.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const total = allGroups.length;
  const start = (page - 1) * limit;
  const items = allGroups.slice(start, start + limit);

  return { items, total, page, limit };
}
