// @TASK T0.5.2 - 시설 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';
import { PaginationSchema } from './common.js';
import { KOREA_BOUNDS, SEARCH_DEFAULTS, PAGINATION, NEARBY_SUMMARY } from '../constants/index.js';

// 카테고리 enum (지도 마커 표시 가능한 시설만)
// trash는 좌표 없는 일정 데이터로 WasteSchedule 별도 테이블에서 관리
export const FacilityCategorySchema = z.enum([
  'toilet',
  'wifi',
  'clothes',
  'parking',
  'aed',
  'library',
  'hospital',
  'pharmacy',
  'park',
  'school',
  'market',
  'childcare',
  'ev-charger',
  'sports',
]);

export type FacilityCategory = z.infer<typeof FacilityCategorySchema>;

// 검색/지역 조회용 카테고리 (trash 포함)
export const RegionCategorySchema = z.enum([
  'toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'trash', 'childcare', 'ev-charger', 'sports',
]);

// 주변 개수 요약용 카테고리.
// - trash 제외: 좌표 없는 일정 데이터(WasteSchedule)라 반경 개념이 없다.
// - ev-charger 제외: 충전기 행 단위라 그대로 세면 "충전소 수"가 아니라 "충전기 수"가 된다.
//   충전소 단위 집계는 statId GROUP BY 가 필요하므로 목록 API(evChargerStationSearch)를 쓴다.
export const NearbyCountCategorySchema = z.enum([
  'toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'sports',
]);

// 주변 시설 개수 요약 요청 스키마 (GET /api/facilities/nearby-counts)
// 목록을 만들지 않고 카테고리별 개수만 돌려준다.
export const NearbyCountsSchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다'),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다'),
  radius: z.coerce
    .number()
    .int()
    .min(NEARBY_SUMMARY.MIN_RADIUS_METERS)
    .max(NEARBY_SUMMARY.MAX_RADIUS_METERS)
    .default(NEARBY_SUMMARY.DEFAULT_RADIUS_METERS),
  // 콤마 구분("school,hospital"). 생략하면 전 카테고리.
  categories: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.split(',').map((c) => c.trim()).filter(Boolean) : undefined))
    .pipe(z.array(NearbyCountCategorySchema).min(1).max(13).optional()),
});

export type NearbyCountsInput = z.infer<typeof NearbyCountsSchema>;

// 시설 검색 요청 스키마
export const FacilitySearchSchema = z
  .object({
    keyword: z.string().min(1).max(100).optional(),
    category: RegionCategorySchema.optional(),
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
    // 병원 진료과목 필터. category=hospital일 때만 의미 있음. AND 매칭(모두 보유한 병원만).
    // 콤마 구분 문자열("내과,외과") 또는 배열(["내과","외과"]) 둘 다 허용.
    departments: z
      .union([z.string().max(500), z.array(z.string().max(50)).max(50)])
      .optional()
      .transform((v) => {
        if (!v) return undefined;
        if (Array.isArray(v)) return v.map((d) => d.trim()).filter(Boolean);
        return v.split(',').map((d) => d.trim()).filter(Boolean);
      }),
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
  category: RegionCategorySchema,
});

// 지역별 전체 카테고리 시설 조회 파라미터 스키마
export const RegionAllFacilitiesParamsSchema = z.object({
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
});

// 지역별 시설 조회 쿼리 스키마 (페이지네이션 + 병원 진료과목 필터)
export const RegionFacilitiesQuerySchema = PaginationSchema.extend({
  departments: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s ? s.split(',').map((d) => d.trim()).filter(Boolean) : undefined)),
});

// 타입 추출
export type FacilitySearchInput = z.infer<typeof FacilitySearchSchema>;
export type FacilityDetailParams = z.infer<typeof FacilityDetailParamsSchema>;
export type RegionFacilitiesParams = z.infer<typeof RegionFacilitiesParamsSchema>;
export type RegionAllFacilitiesParams = z.infer<typeof RegionAllFacilitiesParamsSchema>;
export type RegionFacilitiesQuery = z.infer<typeof RegionFacilitiesQuerySchema>;
