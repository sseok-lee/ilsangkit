import { z } from 'zod';
import { CITY_SLUG_TO_FULL } from '../services/cityMapping.js';
import { DISTRICT_SLUG_MAP } from '../lib/regionSlugs.js';

const CITY_SLUGS = new Set(Object.keys(CITY_SLUG_TO_FULL));
const DISTRICT_SLUGS = new Set(Object.values(DISTRICT_SLUG_MAP));

const slug = z.string().trim().regex(/^[a-z0-9-]+$/).max(50);

export const HomeMarketQuerySchema = z.object({
  city: slug.refine((value) => CITY_SLUGS.has(value), { message: 'unknown city slug' }).optional(),
  district: slug.refine((value) => DISTRICT_SLUGS.has(value), { message: 'unknown district slug' }).optional(),
}).superRefine((query, ctx) => {
  if (!query.city && query.district) {
    ctx.addIssue({
      code: 'custom',
      path: ['district'],
      message: 'city is required when district is provided',
    });
  }
});

export type HomeMarketQueryInput = z.infer<typeof HomeMarketQuerySchema>;
