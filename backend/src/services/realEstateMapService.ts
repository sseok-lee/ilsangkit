import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, serializeRow } from './realEstateService.js';

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
