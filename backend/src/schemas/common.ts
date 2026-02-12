// @TASK T0.5.2 - 공통 Zod 스키마
// @SPEC docs/planning/02-trd.md#API-설계

import { z } from 'zod';
import { PAGINATION, KOREA_BOUNDS } from '../constants/index.js';

// 페이지네이션 스키마
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

// 좌표 스키마 (한국 영역)
export const CoordinatesSchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다'),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다').max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다'),
});

// 정렬 방향 스키마
export const SortOrderSchema = z.enum(['asc', 'desc']).default('asc');

// ID 파라미터 스키마
export const IdParamSchema = z.object({
  id: z.string().min(1).max(50),
});

// 타입 추출
export type Pagination = z.infer<typeof PaginationSchema>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;
