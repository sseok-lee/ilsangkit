import type { AffiliateProvider } from '~/types/affiliateBanner'

export type AffiliateDisclosureSource = 'banner' | 'provider' | 'missing'
export type AffiliateDisclosureLoadState = 'loading' | 'ready' | 'error'

export interface AffiliateProviderDisclosureDto {
  provider: AffiliateProvider
  defaultDisclosureText: string | null
  updatedAt: string | null
}

export interface ResolvedAffiliateDisclosure {
  disclosureText: string | null
  disclosureSource: AffiliateDisclosureSource
}
