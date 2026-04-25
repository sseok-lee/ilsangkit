// LH 공고 (분양/임대) — Zod 스키마
import { z } from 'zod';
import { PaginationSchema } from './common.js';

export const LhAnnouncementListQuerySchema = PaginationSchema.extend({
  uppAisTpCd: z.string().min(1).max(2).optional(),
  aisTpCd: z.string().min(1).max(2).optional(),
  cnpNm: z.string().min(1).max(50).optional(),
  panSs: z.string().min(1).max(20).optional(),
});

export type LhAnnouncementListQuery = z.infer<typeof LhAnnouncementListQuerySchema>;

export const LhAnnouncementIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
