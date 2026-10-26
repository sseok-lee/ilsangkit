import type { FacilityNearbyGroup } from '~/types/facility'

export interface SubwayStation {
  id: string
  sourceId: string
  name: string
  nameSlug: string
  line: string
  transferLines: string[]
  operator: string | null
  lat: number
  lng: number
  address: string | null
  roadAddress: string | null
  city: string | null
  district: string | null
  regionSlug: string | null
  phoneNumber: string | null
  dataDate: string | null
  updatedAt: string
}

/** 지하철역 상세 "주변 시설" — 주변 역 행(역명 단위로 노선을 합친 1행) */
export interface SubwayNearbyStation {
  id: string
  /** 원본 역명(끝 "역" 유무 혼재 — 표시할 때 "역" 1개 보장) */
  name: string
  nameSlug: string
  category: 'subway'
  /** 같은 역명으로 묶인 노선(정렬) */
  lines: string[]
  /** 직선거리(m, 정수) */
  distance: number
}

export interface SubwayNearbyStationGroup {
  category: 'subway'
  /** 반경 안 역 수(역명 단위, 자기 역 제외) */
  count: number
  exact: boolean
  items: SubwayNearbyStation[]
}

/** [주변 역, ...관련 시설 카테고리] — 관련 시설 그룹은 시설 상세 nearby-grouped 와 같은 모양 */
export type SubwayNearbyGroup = SubwayNearbyStationGroup | FacilityNearbyGroup

/** GET /api/subway/stations/:slug/nearby-grouped 의 data */
export interface SubwayNearbyGroupedResponse {
  /** 반경(m) — 1000 */
  radius: number
  /** 좌표 없는 역은 [] */
  groups: SubwayNearbyGroup[]
}
