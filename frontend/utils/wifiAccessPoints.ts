/**
 * wifi 장소 단위 상세에서 AP 목록을 다루는 유틸.
 *
 * 백엔드가 wifi 상세를 장소 단위로 접으면서(ev-charger 의 statId 그룹핑과 같은 방식)
 * details.accessPoints 로 그 장소의 AP 를 전부 내려준다. 원본이 AP 1대=1행이라
 * 한 장소에 AP 가 수십~수백 대인 경우가 흔하다(서울식물원 154대, 에스플렉스센터 179대).
 *
 * 이 값을 안 쓰면 통합의 이점이 화면에 하나도 나타나지 않는다 — 지도에 중심점 핀
 * 하나만 찍히고, AP 가 몇 대인지도 안 보인다.
 */
import type { Facility } from '~/types/facility'

export interface WifiAccessPoint {
  id: string
  lat: number
  lng: number
  ssid: string | null
  installLocation: string | null
  installLocationDetail: string | null
}

export interface WifiLocationGroup {
  label: string
  count: number
}

function toFiniteNumber(v: unknown): number | null {
  // 문자열 좌표도 허용하되(API 직렬화 편차), 숫자가 아니면 버린다.
  // 버리지 않으면 Number(null)=0 이 되어 핀이 (0,0) 으로 튄다.
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 상세 응답에서 AP 배열을 꺼낸다. 통합 상세가 아니면 빈 배열. */
export function parseAccessPoints(details: unknown): WifiAccessPoint[] {
  const raw = (details as { accessPoints?: unknown } | undefined)?.accessPoints
  if (!Array.isArray(raw)) return []

  const out: WifiAccessPoint[] = []
  for (const item of raw) {
    const r = item as Record<string, unknown>
    const lat = toFiniteNumber(r?.lat)
    const lng = toFiniteNumber(r?.lng)
    if (lat === null || lng === null) continue
    out.push({
      id: String(r.id ?? ''),
      lat,
      lng,
      ssid: text(r.ssid) || null,
      installLocation: text(r.installLocation) || null,
      installLocationDetail: text(r.installLocationDetail) || null,
    })
  }
  return out
}

/** AP 하나를 대표하는 장소 라벨. 상세 → 구분명 순으로 넘어간다. */
function labelOf(ap: WifiAccessPoint): string {
  return text(ap.installLocationDetail) || text(ap.installLocation)
}

/**
 * 설치 장소별로 묶어 개수와 함께 돌려준다.
 *
 * 설치장소상세는 AP 식별자가 아니라 구역 라벨이다 — 해운대 백병원은 AP 116대 중
 * 49대가 "본관 A동"을 공유한다. 그래서 나열이 아니라 집계가 맞다.
 */
export function groupAccessPointsByLocation(aps: WifiAccessPoint[]): WifiLocationGroup[] {
  const counts = new Map<string, number>()
  for (const ap of aps) {
    const label = labelOf(ap)
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    // 개수 내림차순, 같으면 이름순 — 정렬이 안정적이어야 렌더가 매번 흔들리지 않는다
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
}

/**
 * AP 를 지도 핀으로 바꾼다.
 *
 * AP 가 없으면(기존 AP 단일 상세) 대표 시설 하나를 그대로 돌려줘 종전 동작을 유지한다.
 */
export function accessPointsToMapFacilities(aps: WifiAccessPoint[], base: Facility): Facility[] {
  if (aps.length === 0) return [base]

  return aps.map((ap) => {
    const label = labelOf(ap)
    return {
      ...base,
      id: ap.id || base.id,
      name: label ? `${base.name} · ${label}` : base.name,
      lat: ap.lat,
      lng: ap.lng,
    }
  })
}

/**
 * AP 들이 전부 들어오도록 카카오 지도 레벨을 고른다.
 *
 * 고정 레벨을 쓰면 넓게 퍼진 그룹에서 핀 대부분이 화면 밖으로 나간다
 * (파주 '버스정류장' 그룹은 반경 29km 였다). 카카오는 레벨이 커질수록 축소되고
 * 한 단계마다 대략 2배씩 넓어진다.
 */
export function mapLevelForAccessPoints(aps: WifiAccessPoint[], fallback = 3): number {
  if (aps.length < 2) return fallback

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const ap of aps) {
    if (ap.lat < minLat) minLat = ap.lat
    if (ap.lat > maxLat) maxLat = ap.lat
    if (ap.lng < minLng) minLng = ap.lng
    if (ap.lng > maxLng) maxLng = ap.lng
  }
  // 위도 1도 ≈ 111km. 경도는 위도에 따라 줄지만 여기서는 상한만 잡으면 되므로
  // 같은 계수를 써서 보수적으로(더 넓게) 잡는다.
  const spreadKm = Math.max(maxLat - minLat, maxLng - minLng) * 111

  const BREAKPOINTS: Array<[number, number]> = [
    [0.1, 3], [0.3, 4], [0.7, 5], [1.5, 6],
    [3, 7], [6, 8], [12, 9], [25, 10], [50, 11],
  ]
  for (const [km, level] of BREAKPOINTS) {
    if (spreadKm <= km) return level
  }
  return 12
}
