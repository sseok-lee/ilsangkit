/**
 * 버스정류장 반경 조회 (BBox prefilter + Haversine, 지하철 조회와 같은 방식).
 *
 * 같은 정류장명의 승강장·양방향 행은 이름(trim)으로 묶어 1건으로 센다.
 */

import { prisma } from '../lib/prisma.js';
import { EARTH_RADIUS_M, haversine, toRad } from './subwayService.js';

export interface NearbyBusStop {
  /** 이름 묶음에서 가장 가까운 행의 nodeId */
  id: string;
  name: string;
  /** 반올림 m */
  distance: number;
}

export interface NearbyBusStopsResult {
  items: NearbyBusStop[];
  /** 이름으로 합친 반경 안 정류장 수 */
  count: number;
  /** 가장 가까운 행의 수집 기준일 */
  collectedAt: string | null;
}

export async function findNearbyBusStops(
  lat: number,
  lng: number,
  radiusM: number,
  limit = 5,
): Promise<NearbyBusStopsResult> {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(0.01, Math.cos(toRad(lat)));

  const candidates = await prisma.busStop.findMany({
    where: {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    },
    select: { nodeId: true, name: true, lat: true, lng: true, collectedAt: true },
  });

  const groups = new Map<string, { id: string; name: string; distance: number; collectedAt: string | null }>();
  for (const c of candidates) {
    const distance = haversine(lat, lng, Number(c.lat), Number(c.lng));
    if (distance > radiusM) continue;
    const name = c.name.trim();
    const g = groups.get(name);
    if (!g || distance < g.distance) {
      groups.set(name, { id: c.nodeId, name, distance, collectedAt: c.collectedAt });
    }
  }

  const sorted = Array.from(groups.values()).sort((a, b) => a.distance - b.distance);
  return {
    items: sorted.slice(0, limit).map((g) => ({ id: g.id, name: g.name, distance: Math.round(g.distance) })),
    count: sorted.length,
    collectedAt: sorted[0]?.collectedAt ?? null,
  };
}
