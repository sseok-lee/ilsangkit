import type { AffiliateProvider } from './affiliateBanner.js';

export interface ResolvedAffiliateDisclosure {
  disclosureText: string | null;
  disclosureSource: 'provider' | 'banner' | 'missing';
}

export interface AffiliateProviderDisclosureDto {
  provider: AffiliateProvider;
  defaultDisclosureText: string | null;
  updatedAt: string | null;
}
