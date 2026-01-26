// @TASK T0.5.2 - 검색 로그 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';

// 검색 로그 스키마
export const SearchLogSchema = z.object({
  sessionId: z.string().length(32),
  keyword: z.string().max(200).optional(),
  category: z.string().max(20).optional(),
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  resultCount: z.number().int().min(0),
});

// 인기 검색어 쿼리 스키마
export const PopularSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  period: z.enum(['day', 'week', 'month']).default('week'),
});

// 타입 추출
export type SearchLogInput = z.infer<typeof SearchLogSchema>;
export type PopularSearchQuery = z.infer<typeof PopularSearchQuerySchema>;
