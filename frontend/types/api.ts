// @TASK T8.1 - API 타입 파일 (facility.ts에서 re-export)
// @DEPRECATED 직접 사용 대신 ~/types/facility 사용 권장
// 하위 호환성을 위해 유지

export {
  type FacilityCategory,
  type Facility,
  type FacilityDetail,
  type SearchParams,
  type SearchResponse,
  type ApiResponse,
  type PaginationParams,
  type PaginatedResponse,
  type ApiErrorDetail,
  type HealthCheckResponse,
  type CategoryInfo,
  type CategoryCount,
  type RegionInfo,
  type CityInfo,
  type DistrictInfo,
  type CategoryMeta,
  CATEGORY_META,
} from './facility'

// Legacy aliases for backward compatibility
export type { Facility as FacilityBase } from './facility'
export type { Facility as FacilitySearchItem } from './facility'
export type { SearchParams as FacilitySearchRequest } from './facility'
export type { SearchParams as RegionFacilitiesRequest } from './facility'
export type { SearchParams as NearbyFacilitiesRequest } from './facility'
