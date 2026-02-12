// @TASK P12-T2 - 프론트엔드 타입 통합 export
// 단일 소스: types/facility.ts
// 모든 타입 정의는 facility.ts에 있으며, 여기서 re-export합니다.

export * from './facility'

// Legacy aliases for backward compatibility
// api.ts에서 사용되던 별칭들을 여기로 통합
export type { Facility as FacilityBase } from './facility'
export type { Facility as FacilitySearchItem } from './facility'
export type { SearchParams as FacilitySearchRequest } from './facility'
export type { SearchParams as RegionFacilitiesRequest } from './facility'
export type { SearchParams as NearbyFacilitiesRequest } from './facility'
