/**
 * wifi 장소 단위(그룹) 조회 서비스.
 *
 * ev-charger 가 statId 로 충전소를 접는 것과 같은 역할을 wifi 에서 한다.
 * 그룹 키의 근거와 주의점은 [[wifiGroup.ts]] 주석 참조.
 */
import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import { bufferViewCount } from './viewCountService.js';
import { isWifiGroupId } from './wifiGroup.js';

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
