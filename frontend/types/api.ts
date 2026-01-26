// @TASK T0.5.1 - 프론트엔드 API 타입 정의
// @SPEC docs/planning/02-trd.md#api-types

/**
 * 시설 카테고리 (Prisma enum 대응)
 */
export type FacilityCategory = 'toilet' | 'trash' | 'wifi' | 'clothes' | 'battery' | 'kiosk';

// ============================================
// API 공통 타입
// ============================================

/**
 * 페이지네이션 요청 파라미터
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * API 에러 상세
 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * 표준 API 응답
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

/**
 * 헬스체크 응답
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}

// ============================================
// 시설 관련 타입
// ============================================

/**
 * 시설 기본 정보
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
 */
export interface FacilityDetail extends FacilityBase {
  bjdCode: string | null;
  details: Record<string, unknown> | null;
  sourceId: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: string; // ISO 8601 format
  updatedAt: string;
  syncedAt: string;
}

/**
 * 검색 결과 항목
 */
export interface FacilitySearchItem extends FacilityBase {
  distance?: number; // meters
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
 * 주변 시설 조회 요청
 */
export interface NearbyFacilitiesRequest {
  lat: number;
  lng: number;
  category?: FacilityCategory;
  radius?: number;
  page?: number;
  limit?: number;
}

// ============================================
// 카테고리 타입
// ============================================

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * 카테고리별 시설 수
 */
export interface CategoryCount {
  category: string;
  count: number;
}

// ============================================
// 지역 타입
// ============================================

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
 * 시/도 정보
 */
export interface CityInfo {
  city: string;
  districtCount: number;
}

/**
 * 구/군 정보
 */
export interface DistrictInfo {
  district: string;
  slug: string;
  lat: number;
  lng: number;
}
