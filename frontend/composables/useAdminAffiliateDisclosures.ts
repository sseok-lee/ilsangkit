import type { AffiliateProvider } from '~/types/affiliateBanner'
import type { AffiliateProviderDisclosureDto } from '~/types/affiliateDisclosure'

type Envelope<T> = { success: boolean; data: T }

export function useAdminAffiliateDisclosures() {
  const base = useApiBase()

  async function list(): Promise<AffiliateProviderDisclosureDto[]> {
    const response = await $fetch<Envelope<AffiliateProviderDisclosureDto[]>>(
      `${base}/api/admin/affiliate-provider-disclosures`,
      { credentials: 'include' }
    )
    return response.data
  }

  async function save(
    provider: AffiliateProvider,
    defaultDisclosureText: string
  ): Promise<AffiliateProviderDisclosureDto> {
    const response = await $fetch<Envelope<AffiliateProviderDisclosureDto>>(
      `${base}/api/admin/affiliate-provider-disclosures/${provider}`,
      {
        method: 'PUT',
        credentials: 'include',
        body: { defaultDisclosureText },
      }
    )
    return response.data
  }

  return { list, save }
}
