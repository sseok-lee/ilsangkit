// LH myhome 매입임대 / 전세임대 카탈로그 — Zod 스키마
import { z } from 'zod';
import { PaginationSchema } from './common.js';

export const PublicRentalListQuerySchema = PaginationSchema.extend({
  city: z.string().min(1).max(20).optional(),
  district: z.string().min(1).max(20).optional(),
  rentalType: z.string().min(1).max(30).optional(),
  depositMin: z.coerce.number().int().nonnegative().optional(),
  depositMax: z.coerce.number().int().nonnegative().optional(),
  monthlyRentMin: z.coerce.number().int().nonnegative().optional(),
  monthlyRentMax: z.coerce.number().int().nonnegative().optional(),
});

export type PublicRentalListQuery = z.infer<typeof PublicRentalListQuerySchema>;

export const PublicRentalIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
