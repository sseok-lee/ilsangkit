import type { AffiliateProvider } from './affiliateBanner.js';

export interface PublicAffiliateBanner {
  id: string;
  provider: AffiliateProvider;
  imageUrl: string;
  targetUrl: string;
  altText: string;
  disclosureText: string;
}
