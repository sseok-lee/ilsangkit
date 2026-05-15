import { z } from 'zod';
import { FacilityCategorySchema } from './facility.js';

export const FacilityYoutubeParamsSchema = z.object({
  category: FacilityCategorySchema,
  id: z.string().min(1).max(100),
});

export type FacilityYoutubeParams = z.infer<typeof FacilityYoutubeParamsSchema>;
