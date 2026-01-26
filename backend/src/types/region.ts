// @TASK T0.5.1 - 지역 타입 정의
// @SPEC docs/planning/02-trd.md#region-types

/**
 * 지역 정보
 */
export interface RegionInfo {
  id: number;
  bjdCode: string;
  city: string;
  district: string;
  slug: string;
  lat: number;
  lng: number;
}

/**
 * 시/도 목록 조회 응답
 */
export interface CityInfo {
  city: string;
  districtCount: number;
}

/**
 * 구/군 목록 조회 응답
 */
export interface DistrictInfo {
  district: string;
  slug: string;
  lat: number;
  lng: number;
}
