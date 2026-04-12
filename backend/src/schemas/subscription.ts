import { z } from 'zod';

export const SubscriptionStatusSchema = z.enum(['upcoming', 'ongoing', 'closed']);

export const SubscriptionListSchema = z.object({
  status: SubscriptionStatusSchema.optional(),
  region: z.string().max(100).optional(),
  houseType: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SubscriptionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type SubscriptionListParams = z.infer<typeof SubscriptionListSchema>;
