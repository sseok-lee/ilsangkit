// @TASK T0.5.1 - 시설 관련 타입 정의
// @SPEC docs/planning/02-trd.md#facility-types

import { FacilityCategory } from '@prisma/client';

/**
 * 시설 기본 정보
 * 목록 조회 시 사용되는 최소 정보
 */
export interface FacilityBase {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
}

/**
 * 시설 상세 정보
 * 상세 조회 시 모든 정보 포함
 */
export interface FacilityDetail extends FacilityBase {
  bjdCode: string | null;
  details: Record<string, unknown> | null;
  sourceId: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

/**
 * 검색 결과 항목
 * 위치 기반 검색 시 거리 정보 포함
 */
export interface FacilitySearchItem extends FacilityBase {
  distance?: number; // meters, 위치 기반 검색 시에만 포함
}

/**
 * 시설 검색 요청 파라미터
 */
export interface FacilitySearchRequest {
  keyword?: string;
  category?: FacilityCategory;
  lat?: number;
  lng?: number;
  radius?: number; // meters, default 1000
  city?: string;
  district?: string;
  page?: number;
  limit?: number;
}

/**
 * 지역별 시설 조회 요청
 */
export interface RegionFacilitiesRequest {
  city: string;
  district: string;
  category: FacilityCategory;
  page?: number;
  limit?: number;
}

/**
 * 주변 시설 조회 요청 (위치 기반)
 */
export interface NearbyFacilitiesRequest {
  lat: number;
  lng: number;
  category?: FacilityCategory;
  radius?: number; // meters, default 1000
  page?: number;
  limit?: number;
}
