import { z } from 'zod';
import { GUIDE_CATEGORIES } from '../services/articleGenerationCore.js';

export const AdminLoginSchema = z.object({ password: z.string().min(1).max(200) });

export const AdminArticleListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'published', 'rejected']).optional(),
  category: z.string().optional(),
});
export const AdminArticleIdSchema = z.object({ id: z.string().min(1).max(40) });
export const AdminArticlePatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(500).optional(),
  keywords: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: '수정할 필드가 없습니다' });

// 생성 트리거 — count는 범위를 벗어나도 거부하지 않고 1~3으로 클램프(spawn 전 항상 안전한 값만 전달).
// category는 GUIDE_CATEGORIES allowlist만 허용(그 외 값은 422로 거부, spawn 도달 불가).
export const AdminGenerateSchema = z.object({
  count: z.coerce.number()
    .transform((n) => (Number.isFinite(n) ? Math.min(3, Math.max(1, Math.trunc(n))) : 3))
    .default(3),
  category: z.enum(GUIDE_CATEGORIES).optional(),
});
