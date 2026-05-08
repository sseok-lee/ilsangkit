/**
 * 지하철역 조회 서비스 (BBox prefilter + Haversine).
 *
 * 한국 영토(KOREA_BOUNDS lat 33-39) 가정. cos(lat) 클램프 불필요.
 */

import type { SubwayStation } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

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
