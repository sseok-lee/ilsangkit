import type { ResolvedAffiliateDisclosure } from './affiliateDisclosure.js';

export const AFFILIATE_PROVIDERS = ['coupang', 'ali', 'toss'] as const;

export type AffiliateProvider = (typeof AFFILIATE_PROVIDERS)[number];
export type AffiliateImageSourceType = 'upload' | 'url';

export interface AffiliateBannerDraft {
  provider: AffiliateProvider;
  name: string;
  imageSourceType: AffiliateImageSourceType;
  imageAssetId: string | null;
  externalImageUrl: string | null;
  targetUrl: string;
  altText: string;
  disclosureOverride: string | null;
}

export type AffiliateBannerPatch = Partial<AffiliateBannerDraft>;

export interface AffiliateBannerDto extends AffiliateBannerDraft, ResolvedAffiliateDisclosure {
  id: string;
  imageUrl: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateBannerQuery {
  page: number;
  limit: number;
  provider?: AffiliateProvider;
  isEnabled?: boolean;
}

export interface AffiliateBannerPage {
  items: AffiliateBannerDto[];
  total: number;
  page: number;
  totalPages: number;
}

export interface UploadedAffiliateBannerImage {
  imageAssetId: string;
  imageUrl: string;
}
