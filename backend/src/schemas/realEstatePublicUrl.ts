import { z } from 'zod';
import { RealEstateTypeSchema } from './realEstate.js';

export const ResolveRealEstateUrlQuery = z.object({
  path: z.string().max(8192).regex(/^\/real-estate\/(?:apt|villa|offitel)-(?:sale|rent)\/[^/?#]+\/[^/?#]+\/[^/?#]+(?:\/[^/?#]+)?$/)
    .refine((value) => {
      try {
        return !decodeURIComponent(value).includes('\0');
      } catch {
        return false;
      }
    }, 'Invalid URL encoding'),
});

export const RealEstateCanonicalUrlQuery = z.object({
  type: RealEstateTypeSchema,
  buildingKey: z.string().regex(/^[a-f0-9]{64}$/),
});
