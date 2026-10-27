import { isBuildingItem, type Granularity, type MapItem } from '~/types/realEstateMap'
import { cityDisplayName } from '~/composables/useMapOverlays'
import { explorationListHref } from '~/utils/explorationNavigation'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'

/**
 * 지도 위치 경로("서울 › 서초구 › 서초동")의 한 칸.
 *
 * 마지막 칸은 지금 보고 있는 곳이라 href·level 이 null 이다(링크가 아니라 글자).
 * 상위 칸을 누르면 지도를 그 단계 level 로 올린다 — 값은 RealEstateMapExplorer.onSelect 의
 * 드릴다운 level(9/7/5)과 같은 표를 쓴다: 전국 13, 시·도 9(구·군 단계), 구·군 7(동 단계).
 * href 는 같은 지역의 목록 허브다 — ⌘/Ctrl 클릭(새 탭)과 링크 의미를 위해 둔다.
 */
export interface MapPathCrumb {
  label: string
  href: string | null
  level: number | null
  /** 시·도 칸이면 원래 city 값(좌표 찾기용). */
  city?: string
  district?: string
}

/** 지도 중심에서 가장 가까운 항목. 경도 차이는 위도에 따라 줄어들어 cos 로 보정한다. */
function nearestItem(items: MapItem[], center: { lat: number; lng: number }): MapItem | null {
  const k = Math.cos((center.lat * Math.PI) / 180)
  let best: MapItem | null = null
  let bestD = Infinity
  for (const item of items) {
    if (item.lat == null || item.lng == null) continue
    const d = (item.lat - center.lat) ** 2 + ((item.lng - center.lng) * k) ** 2
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  return best
}

/**
 * 현재 지도 위치 경로. 중심에서 가장 가까운 항목의 행정구역으로 정한다.
 *
 * 시·도 단계는 "전국" 한 칸이다. 그 아래 단계에서 좌표 있는 항목이 하나도 없으면(빈 뷰포트,
 * 로딩 실패) 위치를 정할 수 없으므로 null → 호출부가 숨긴다.
 */
export function buildMapLocationPath(
  granularity: Granularity,
  items: MapItem[],
  center: { lat: number; lng: number },
  type: string,
): MapPathCrumb[] | null {
  const t = type as RealEstateUrlType
  const nation: MapPathCrumb = { label: '전국', href: `/real-estate/${type}`, level: 13 }
  if (granularity === 'city') return [{ ...nation, href: null, level: null }]

  const near = nearestItem(items, center)
  if (!near) return null

  const city = isBuildingItem(near) ? near.city : near.name
  const district = near.district
  const dong = isBuildingItem(near) ? near.dongName : near.dong
  const cityCrumb: MapPathCrumb = {
    label: cityDisplayName(city), href: explorationListHref(t, { city }), level: 9, city,
  }

  if (granularity === 'district') return [nation, { ...cityCrumb, href: null, level: null }]
  if (!district) return [nation, cityCrumb]

  const districtCrumb: MapPathCrumb = {
    label: district, href: explorationListHref(t, { city, district }), level: 7, city, district,
  }
  if (granularity === 'dong') return [nation, cityCrumb, { ...districtCrumb, href: null, level: null }]
  if (!dong) return [nation, cityCrumb, districtCrumb]
  return [nation, cityCrumb, districtCrumb, { label: dong, href: null, level: null }]
}
