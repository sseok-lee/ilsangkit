/**
 * EV 충전소 단위 검색 및 상세 조회 서비스
 * - $queryRaw GROUP BY statId 기반 충전소 단위 그룹핑
 */

import prisma from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, SHORT_TO_SLUG, FULL_TO_SLUG } from './cityMapping.js';
import { bufferViewCount } from './viewCountService.js';

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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

interface SearchResult {
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
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

/**
 * ev-charger 충전소(station) 단위 검색 — $queryRaw로 GROUP BY statId
 */
export async function evChargerStationSearch(params: {
  keyword?: string; city?: string; district?: string;
  lat?: number; lng?: number; radius?: number;
  swLat?: number; swLng?: number; neLat?: number; neLng?: number;
  page: number; limit: number;
}): Promise<SearchResult> {
  const { keyword, city, district, lat, lng, radius, swLat, swLng, neLat, neLng, page, limit } = params;
  const conditions: string[] = ['statId IS NOT NULL'];
  const values: unknown[] = [];

  if (keyword) {
    conditions.push('(name LIKE ? OR address LIKE ? OR roadAddress LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const full = CITY_SLUG_TO_FULL[slug];
      const short = CITY_SLUG_TO_SHORT[slug];
      const variants = [city, full, short].filter(Boolean);
      const unique = [...new Set(variants)];
      if (unique.length > 1) {
        conditions.push(`city IN (${unique.map(() => '?').join(', ')})`);
        values.push(...unique);
      } else {
        conditions.push('city = ?');
        values.push(city);
      }
    } else {
      conditions.push('city = ?');
      values.push(city);
    }
  }
  if (district) { conditions.push('district = ?'); values.push(district); }

  // 좌표 기반 범위 필터
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const radiusKm = radius / 1000;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
    conditions.push('lat BETWEEN ? AND ?');
    values.push(lat - latDelta, lat + latDelta);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(lng - lngDelta, lng + lngDelta);
  }

  // bounds 기반 필터
  if (swLat !== undefined && swLng !== undefined && neLat !== undefined && neLng !== undefined) {
    conditions.push('lat BETWEEN ? AND ?');
    values.push(swLat, neLat);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(swLng, neLng);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countResult: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT statId) as cnt FROM EvCharger WHERE ${whereClause}`,
    ...values,
  );
  const total = Number(countResult[0]?.cnt || 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT statId, MIN(name) as name, MIN(address) as address, MIN(roadAddress) as roadAddress,
            MIN(lat) as lat, MIN(lng) as lng, MIN(city) as city, MIN(district) as district,
            COUNT(*) as totalChargers,
            SUM(CASE WHEN CAST(output AS DECIMAL) >= 50 THEN 1 ELSE 0 END) as rapidCount,
            SUM(CASE WHEN CAST(output AS DECIMAL) < 50 THEN 1 ELSE 0 END) as slowCount
     FROM EvCharger WHERE ${whereClause}
     GROUP BY statId ORDER BY name ASC LIMIT ? OFFSET ?`,
    ...values, limit, offset,
  );

  let items: FacilityItem[] = rows.map((r) => ({
    id: r.statId,
    category: 'ev-charger' as FacilityCategory,
    name: r.name || '',
    address: r.address || null,
    roadAddress: r.roadAddress || null,
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
    city: r.city || '',
    district: r.district || '',
    extras: {
      totalChargers: Number(r.totalChargers),
      rapidCount: Number(r.rapidCount),
      slowCount: Number(r.slowCount),
    },
  }));

  // 좌표 검색 시 Haversine 거리 계산 + 거리순 정렬
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    items = items
      .map((item) => ({
        ...item,
        distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
      }))
      .filter((item) => item.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);
    return { items: items.slice(0, limit), total: items.length, page, totalPages: Math.ceil(items.length / limit) };
  }

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * ev-charger 충전소 상세 조회 — statId로 조회, 모든 충전기 포함
 */
export async function getEvChargerStationDetail(statId: string): Promise<FacilityDetail | null> {
  const chargers = await prisma.evCharger.findMany({
    where: { statId },
    orderBy: [{ chgerId: 'asc' }],
  });

  if (chargers.length === 0) return null;

  const first = chargers[0];

  // 조회수 증가 (배치 처리)
  bufferViewCount('ev-charger', first.id);

  const chargerList = chargers.map((c) => ({
    chgerId: c.chgerId,
    chgerType: c.chgerType,
    output: c.output,
    stat: c.stat,
    statUpdDt: c.statUpdDt,
    method: c.method,
    maker: c.maker,
  }));

  return {
    id: statId,
    category: 'ev-charger' as FacilityCategory,
    name: first.name,
    address: first.address,
    roadAddress: first.roadAddress,
    lat: Number(first.lat),
    lng: Number(first.lng),
    city: first.city,
    district: first.district,
    bjdCode: first.bjdCode,
    details: {
      statId: first.statId,
      useTime: first.useTime,
      busiNm: first.busiNm,
      busiCall: first.busiCall,
      parkingFree: first.parkingFree,
      limitYn: first.limitYn,
      limitDetail: first.limitDetail,
      location: first.location,
      addrDetail: first.addrDetail,
      note: first.note,
      year: first.year,
      chargers: chargerList,
    },
    sourceId: first.sourceId,
    sourceUrl: first.sourceUrl,
    viewCount: first.viewCount,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    syncedAt: first.syncedAt,
  };
}
