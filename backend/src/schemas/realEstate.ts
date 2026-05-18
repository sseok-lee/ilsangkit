// @TASK Phase3-1 - 부동산 Zod 스키마

import { z } from 'zod';

// 부동산 거래 유형 enum
export const RealEstateTypeSchema = z.enum([
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
]);

export type RealEstateType = z.infer<typeof RealEstateTypeSchema>;

// 부동산 검색 요청 스키마
export const RealEstateSearchSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  bjdCode: z.string().max(10).optional(),
  buildingName: z.string().max(100).optional(),
  dealYear: z.coerce.number().optional(),
  dealMonth: z.coerce.number().optional(),
  exclusiveArea: z.coerce.number().positive().optional(),
  rentType: z.enum(['전세', '월세']).optional(),
  months: z.coerce.number().positive().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type RealEstateSearch = z.infer<typeof RealEstateSearchSchema>;

// 부동산 통계 요청 스키마
export const RealEstateStatsSchema = z.object({
  bjdCode: z.string().max(10),
  buildingName: z.string().max(100),
  months: z.coerce.number().positive().optional(),
  exclusiveArea: z.coerce.number().positive().optional(),
  rentType: z.enum(['전세', '월세']).optional(),
});

export type RealEstateStats = z.infer<typeof RealEstateStatsSchema>;

// 부동산 단지 조회 스키마
export const RealEstateComplexSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  buildingName: z.string().max(100).optional(),
  category: RealEstateTypeSchema.optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(15),
});

// 부동산 건물 정보 스키마
export const RealEstateBuildingInfoSchema = z.object({
  bjdCode: z.string().max(10),
  buildingName: z.string().max(100),
});

export type RealEstateComplex = z.infer<typeof RealEstateComplexSchema>;

// 부동산 통합 검색 스키마
export const RealEstateUnifiedSearchSchema = z.object({
  keyword: z.string().max(100).optional(),
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
});

export type RealEstateUnifiedSearch = z.infer<typeof RealEstateUnifiedSearchSchema>;

// 면적 그룹 조회 스키마
export const AreaGroupsQuerySchema = z.object({
  bjdCode: z.string(),
  buildingName: z.string().optional(),
});

export type AreaGroupsQuery = z.infer<typeof AreaGroupsQuerySchema>;

// 가격 심화 분석 조회 스키마
export const PriceAnalysisQuerySchema = z.object({
  bjdCode: z.string().max(10),
  buildingName: z.string().max(100),
});

export type PriceAnalysisQuery = z.infer<typeof PriceAnalysisQuerySchema>;

// 인근 단지 조회 스키마 — /api/real-estate/nearby
export const NearbyQuerySchema = z.object({
  bjdCode: z.string().length(10),
  mode: z.enum(['sale', 'rent']),
  rentType: z.enum(['all', 'jeonse', 'wolse']).default('all'),
  excludeBuildingName: z.string().max(100).optional(),
  limitPerType: z.coerce.number().int().positive().max(20).default(4),
});

export type NearbyQuery = z.infer<typeof NearbyQuerySchema>;
