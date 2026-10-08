export type PublicAffiliateProvider = 'coupang' | 'ali' | 'toss'

export interface PublicAffiliateBanner {
  id: string
  provider: PublicAffiliateProvider
  imageUrl: string
  targetUrl: string
  altText: string
  disclosureText: string
  expiresAt: string | null
}

export interface PublicAffiliateBannerResponse {
  success: true
  data: PublicAffiliateBanner | null
  serverTime: string
}
