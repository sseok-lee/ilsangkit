import type { AffiliateDisclosureSource } from './affiliateDisclosure'

export type AffiliateProvider = 'coupang' | 'ali' | 'toss'
export type AffiliateImageSourceType = 'upload' | 'url'

export interface AffiliateBannerDraft {
  provider: AffiliateProvider
  name: string
  imageSourceType: AffiliateImageSourceType
  imageAssetId: string | null
  externalImageUrl: string | null
  targetUrl: string
  altText: string
  disclosureOverride: string | null
  endDate: string | null
}

export type AffiliateBannerPatch = Partial<AffiliateBannerDraft>

export interface AffiliateBannerDto extends AffiliateBannerDraft {
  id: string
  imageUrl: string
  disclosureText: string | null
  disclosureSource: AffiliateDisclosureSource
  isEnabled: boolean
  isExpired: boolean
  createdAt: string
  updatedAt: string
}

export interface AffiliateBannerQuery {
  page: number
  limit: number
  provider?: AffiliateProvider
  isEnabled?: boolean
}

export interface AffiliateBannerPage {
  items: AffiliateBannerDto[]
  total: number
  page: number
  totalPages: number
}

export interface UploadedAffiliateBannerImage {
  imageAssetId: string
  imageUrl: string
}
