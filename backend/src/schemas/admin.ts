import { z } from 'zod';

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
