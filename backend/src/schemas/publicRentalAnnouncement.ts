// 마이홈 공공임대 모집공고 — Zod 스키마
import { z } from 'zod';
import { PaginationSchema } from './common.js';

export const AnnouncementStatusSchema = z.enum(['ongoing', 'upcoming', 'closed', 'unknown']);
export const AnnouncementSourceSchema = z.enum(['general', 'longTerm']);

export const PublicRentalAnnouncementListQuerySchema = PaginationSchema.extend({
  city: z.string().min(1).max(20).optional(),
  district: z.string().min(1).max(20).optional(),
  rentalType: z.string().min(1).max(60).optional(),
  source: AnnouncementSourceSchema.optional(),
  status: AnnouncementStatusSchema.optional(),
  q: z.string().min(1).max(80).optional(),
});

export type PublicRentalAnnouncementListQuery = z.infer<
  typeof PublicRentalAnnouncementListQuerySchema
>;

export const PublicRentalAnnouncementParamsSchema = z.object({
  pblancId: z.string().min(1).max(40),
});
