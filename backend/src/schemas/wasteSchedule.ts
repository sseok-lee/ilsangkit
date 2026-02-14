// 쓰레기 배출 일정 API 스키마
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { z } from 'zod';
import { PaginationSchema } from './common.js';

// 쓰레기 배출 일정 조회 스키마
export const WasteScheduleQuerySchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  keyword: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// 지역 목록 조회 스키마 (페이지네이션)
export const WasteScheduleRegionsQuerySchema = PaginationSchema;

// 타입 추출
export type WasteScheduleQuery = z.infer<typeof WasteScheduleQuerySchema>;
export type WasteScheduleRegionsQuery = z.infer<typeof WasteScheduleRegionsQuerySchema>;
