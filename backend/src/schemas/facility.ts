// @TASK T0.5.2 - 시설 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';
import { PaginationSchema, RadiusSchema } from './common.js';

// 카테고리 enum
export const FacilityCategorySchema = z.enum([
  'toilet',
  'trash',
  'wifi',
  'clothes',
  'battery',
  'kiosk',
]);

export type FacilityCategory = z.infer<typeof FacilityCategorySchema>;

// 시설 검색 요청 스키마
export const FacilitySearchSchema = z
  .object({
    keyword: z.string().min(1).max(100).optional(),
    category: FacilityCategorySchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: RadiusSchema.optional(),
    city: z.string().max(50).optional(),
    district: z.string().max(50).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) => {
      // lat/lng는 함께 제공되어야 함
      if ((data.lat !== undefined) !== (data.lng !== undefined)) {
        return false;
      }
      return true;
    },
    { message: 'lat과 lng는 함께 제공되어야 합니다' }
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

// 지역별 시설 조회 쿼리 스키마
export const RegionFacilitiesQuerySchema = PaginationSchema;

// 주변 시설 검색 스키마
export const NearbyFacilitiesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: RadiusSchema.optional(),
  category: FacilityCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 타입 추출
export type FacilitySearchInput = z.infer<typeof FacilitySearchSchema>;
export type FacilityDetailParams = z.infer<typeof FacilityDetailParamsSchema>;
export type RegionFacilitiesParams = z.infer<typeof RegionFacilitiesParamsSchema>;
export type RegionFacilitiesQuery = z.infer<typeof RegionFacilitiesQuerySchema>;
export type NearbyFacilitiesInput = z.infer<typeof NearbyFacilitiesSchema>;
