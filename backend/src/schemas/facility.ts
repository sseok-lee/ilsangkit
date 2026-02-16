// @TASK T0.5.2 - 시설 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';
import { PaginationSchema } from './common.js';
import { KOREA_BOUNDS, SEARCH_DEFAULTS, PAGINATION } from '../constants/index.js';

// 카테고리 enum (지도 마커 표시 가능한 시설만)
// trash는 좌표 없는 일정 데이터로 WasteSchedule 별도 테이블에서 관리
export const FacilityCategorySchema = z.enum([
  'toilet',
  'wifi',
  'clothes',
  'kiosk',
  'parking',
  'aed',
  'library',
  'hospital',
  'pharmacy',
]);

export type FacilityCategory = z.infer<typeof FacilityCategorySchema>;

// 시설 검색 요청 스키마
export const FacilitySearchSchema = z
  .object({
    keyword: z.string().min(1).max(100).optional(),
    category: FacilityCategorySchema.optional(),
    lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다').optional(),
    lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다').optional(),
    radius: z.coerce.number().int().min(SEARCH_DEFAULTS.MIN_RADIUS_METERS).max(SEARCH_DEFAULTS.MAX_RADIUS_METERS).default(SEARCH_DEFAULTS.RADIUS_METERS).optional(),
    swLat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다').optional(),
    swLng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다').optional(),
    neLat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다').optional(),
    neLng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다').optional(),
    city: z.string().max(50).optional(),
    district: z.string().max(50).optional(),
    page: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
    grouped: z.boolean().optional().default(false),
    sort: z.enum(['name', 'latest', 'popular']).optional().default('name'),
  })
  .refine(
    (data) => {
      if ((data.lat !== undefined) !== (data.lng !== undefined)) return false;
      return true;
    },
    { message: 'lat과 lng는 함께 제공되어야 합니다' }
  )
  .refine(
    (data) => {
      const boundsFields = [data.swLat, data.swLng, data.neLat, data.neLng];
      const defined = boundsFields.filter((f) => f !== undefined).length;
      return defined === 0 || defined === 4;
    },
    { message: 'swLat, swLng, neLat, neLng는 모두 함께 제공되어야 합니다' }
  );

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

// 지역별 전체 카테고리 시설 조회 파라미터 스키마
export const RegionAllFacilitiesParamsSchema = z.object({
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
});

// 지역별 시설 조회 쿼리 스키마
export const RegionFacilitiesQuerySchema = PaginationSchema;

// 타입 추출
export type FacilitySearchInput = z.infer<typeof FacilitySearchSchema>;
export type FacilityDetailParams = z.infer<typeof FacilityDetailParamsSchema>;
export type RegionFacilitiesParams = z.infer<typeof RegionFacilitiesParamsSchema>;
export type RegionAllFacilitiesParams = z.infer<typeof RegionAllFacilitiesParamsSchema>;
export type RegionFacilitiesQuery = z.infer<typeof RegionFacilitiesQuerySchema>;
