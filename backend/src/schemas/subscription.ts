import { z } from 'zod';

export const SubscriptionStatusSchema = z.enum(['upcoming', 'ongoing', 'closed']);

export const SubscriptionSourceTypeSchema = z.enum(['APT', 'OFFITEL', 'REMAINING', 'PRIVATE_RENT']);

export const SubscriptionCategorySchema = z.enum(['sale', 'rent']);

export const SubscriptionListSchema = z.object({
  status: SubscriptionStatusSchema.optional(),
  region: z.string().max(100).optional(),
  houseType: z.string().max(20).optional(),
  rentType: z.string().max(20).optional(),
  sourceType: SubscriptionSourceTypeSchema.optional(),
  category: SubscriptionCategorySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SubscriptionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const RentalPriceStatsSchema = z.object({
  jeonsae: z.object({
    avgDeposit: z.number().nullable(),
    count: z.number().int(),
  }),
  wolse: z.object({
    avgDeposit: z.number().nullable(),
    avgMonthlyRent: z.number().nullable(),
    count: z.number().int(),
  }),
  period: z.string(),
});

export type SubscriptionListParams = z.infer<typeof SubscriptionListSchema>;
export type RentalPriceStats = z.infer<typeof RentalPriceStatsSchema>;
