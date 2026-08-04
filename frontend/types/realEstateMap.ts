import type { RealEstateType } from '~/types/realEstate'

export type Granularity = 'city' | 'district' | 'dong' | 'building'

export interface MapBounds {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export interface MapRegionItem {
  name: string
  district: string | null
  /** granularity='dong' 일 때만 채워진다. city/district 에서는 null. */
  dong: string | null
  /**
   * null = 좌표 없음(집계 폴백). `0`을 "없음" 의미로 쓰지 않는다 — (0,0)은 기니만 앞바다의
   * 유효한 좌표라 지도가 실제로 그리로 이동해버리는 사고가 난 적이 있다
   * (MapSidebar 의 SIDO_CHIPS 폴백 항목 참고).
   */
  lat: number | null
  lng: number | null
  avgPricePerPyeong: number | null
  transactionCount: number
}

export interface MapBuildingItem {
  buildingName: string
  city: string
  district: string
  dongName: string
  lat: number | null
  lng: number | null
  /** 매매=거래금액, 전월세=보증금 (만원) */
  latestPrice: number | null
  /** null=매매 / 0=전세 / >0=월세 */
  monthlyRent: number | null
  latestDealYear: number | null
  latestDealMonth: number | null
  latestDealDay: number | null
  transactionCount: number
}

export type MapItem = MapRegionItem | MapBuildingItem

export interface MapResponse {
  success: boolean
  data: {
    granularity: Granularity
    items: MapItem[]
    total: number
    exact: boolean
  }
}

export const MAP_TYPES: RealEstateType[] = [
  'apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent',
]

/** 백엔드 KOREA_BOUNDS 와 동일해야 한다. 어긋나면 드래그 시 422 가 난다. */
export const KOREA_BOUNDS = { LAT_MIN: 33, LAT_MAX: 39, LNG_MIN: 124, LNG_MAX: 132 } as const

export function isBuildingItem(i: MapItem): i is MapBuildingItem {
  return 'buildingName' in i
}
