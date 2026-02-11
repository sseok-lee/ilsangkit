// @TASK T0.5.2 - 시설 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';
import { PaginationSchema } from './common.js';

// 카테고리 enum (지도 마커 표시 가능한 시설만)
// trash는 좌표 없는 일정 데이터로 WasteSchedule 별도 테이블에서 관리
export const FacilityCategorySchema = z.enum([
  'toilet',
  'wifi',
  'clothes',
  'kiosk',
  'parking',
]);

export type FacilityCategory = z.infer<typeof FacilityCategorySchema>;

// 시설 검색 요청 스키마
// NOTE: 사용자 GPS 좌표(lat/lng)는 위치정보사업 신고 의무 회피를 위해
// 서버로 전송하지 않음. 거리 계산은 클라이언트에서 수행.
export const FacilitySearchSchema = z.object({
  keyword: z.string().min(1).max(100).optional(),
  category: FacilityCategorySchema.optional(),
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 시설 상세 조회 파라미터 스키마
export const FacilityDetailParamsSchema = z.object({
  category: FacilityCategorySchema,
  id: z.string().min(1).max(50),
});

// 지역별 시설 조회 파라미터 스키마
export const RegionFacilitiesParamsSchema = z.object({
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
  category: FacilityCategorySchema,
});

// 지역별 시설 조회 쿼리 스키마
export const RegionFacilitiesQuerySchema = PaginationSchema;

// 타입 추출
export type FacilitySearchInput = z.infer<typeof FacilitySearchSchema>;
export type FacilityDetailParams = z.infer<typeof FacilityDetailParamsSchema>;
export type RegionFacilitiesParams = z.infer<typeof RegionFacilitiesParamsSchema>;
export type RegionFacilitiesQuery = z.infer<typeof RegionFacilitiesQuerySchema>;
