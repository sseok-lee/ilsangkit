// @TASK T0.5.1 - 프론트엔드 타입 통합 export
// @SPEC docs/planning/02-trd.md

// API 타입 (백엔드와 동기화)
export * from './api';

// ============================================
// 레거시 타입 별칭 (하위 호환성)
// ============================================

import type { FacilityCategory, FacilitySearchItem, PaginatedResponse } from './api';

/**
 * @deprecated FacilityCategory 사용 권장
 */
export type FacilityType = FacilityCategory;

/**
 * @deprecated FacilitySearchItem 사용 권장
 */
export interface Facility {
  id: number;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address: string;
  distance?: number;
  details?: Record<string, unknown>;
}

/**
 * @deprecated FacilitySearchRequest 사용 권장
 */
export interface SearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  type?: FacilityType;
  page?: number;
  limit?: number;
}

/**
 * @deprecated PaginatedResponse<FacilitySearchItem> 사용 권장
 */
export interface SearchResponse {
  items: Facility[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * @deprecated ApiErrorDetail 사용 권장
 */
export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}
