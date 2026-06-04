// 토지 실거래가 API Zod 스키마

import { z } from 'zod';

// GET /api/real-estate/land/regions — 동 목록
export const LandRegionListSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type LandRegionList = z.infer<typeof LandRegionListSchema>;

// GET /api/real-estate/land/region — 동 상세
export const LandRegionDetailSchema = z.object({
  bjdCode: z.string().min(1).max(10),
  dongName: z.string().min(1).max(50),
  months: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type LandRegionDetail = z.infer<typeof LandRegionDetailSchema>;
