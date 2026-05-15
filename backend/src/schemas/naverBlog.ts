import { z } from 'zod';
import { FacilityCategorySchema } from './facility.js';

export const FacilityNaverBlogParamsSchema = z.object({
  category: FacilityCategorySchema,
  id: z.string().min(1).max(100),
});

export const REAL_ESTATE_TYPES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'] as const;

export const RealEstateNaverBlogParamsSchema = z.object({
  type: z.enum(REAL_ESTATE_TYPES),
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
  buildingName: z.string().min(1).max(200),
});

export type FacilityNaverBlogParams = z.infer<typeof FacilityNaverBlogParamsSchema>;
export type RealEstateNaverBlogParams = z.infer<typeof RealEstateNaverBlogParamsSchema>;
