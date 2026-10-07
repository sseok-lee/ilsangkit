import { z } from 'zod';
import { AFFILIATE_PROVIDERS } from '../types/affiliateBanner.js';
import { normalizeAffiliateDisclosureText } from '../utils/affiliateDisclosure.js';

export const affiliateDisclosureTextSchema = z.string()
  .transform(normalizeAffiliateDisclosureText)
  .pipe(z.string().min(1).max(1000));

export const affiliateDisclosureProviderParamsSchema = z.object({
  provider: z.enum(AFFILIATE_PROVIDERS),
}).strict();

export const affiliateDisclosureSaveSchema = z.object({
  defaultDisclosureText: affiliateDisclosureTextSchema,
}).strict();

export type AffiliateDisclosureSaveInput = z.input<typeof affiliateDisclosureSaveSchema>;
