// 토지 실거래가 API Zod 스키마

import { z } from 'zod';

// GET /api/real-estate/land/regions — 동 목록
export const LandRegionListSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  // 동 단건 조회용. 상세 페이지가 목록을 받아 find 하는 대신 이 필터로 그 동만 가져간다.
  dongName: z.string().max(50).optional(),
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

// GET /api/real-estate/land/transactions — 전체 거래 내역 페이지네이션
export const LandTransactionsSchema = z.object({
  bjdCode: z.string().min(1).max(10),
  dongName: z.string().min(1).max(50),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type LandTransactions = z.infer<typeof LandTransactionsSchema>;
