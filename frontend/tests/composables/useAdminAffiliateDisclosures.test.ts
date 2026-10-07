import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminAffiliateDisclosures } from '~/composables/useAdminAffiliateDisclosures'
import type { AffiliateProviderDisclosureDto } from '~/types/affiliateDisclosure'

const disclosure = (overrides: Partial<AffiliateProviderDisclosureDto> = {}): AffiliateProviderDisclosureDto => ({
  provider: 'coupang',
  defaultDisclosureText: '테스트 기본 문구',
  updatedAt: '2026-10-07T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  vi.mocked($fetch).mockReset()
  vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
})

describe('useAdminAffiliateDisclosures', () => {
  it('lists provider disclosure settings from the admin endpoint with credentials', async () => {
    const data = [
      disclosure(),
      disclosure({ provider: 'ali', defaultDisclosureText: null, updatedAt: null }),
      disclosure({ provider: 'toss', defaultDisclosureText: null, updatedAt: null }),
    ]
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data })

    await expect(useAdminAffiliateDisclosures().list()).resolves.toEqual(data)

    expect($fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/admin/affiliate-provider-disclosures',
      { credentials: 'include' }
    )
  })

  it('saves normalized caller text for a single provider with the exact PUT body', async () => {
    const saved = disclosure({ provider: 'ali', defaultDisclosureText: '저장 문구' })
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: saved })

    await expect(useAdminAffiliateDisclosures().save('ali', '저장 문구')).resolves.toEqual(saved)

    expect($fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/admin/affiliate-provider-disclosures/ali',
      {
        method: 'PUT',
        credentials: 'include',
        body: { defaultDisclosureText: '저장 문구' },
      }
    )
  })

  it('passes fetch failures through to the caller', async () => {
    const error = new Error('storage failed')
    vi.mocked($fetch).mockRejectedValueOnce(error)

    await expect(useAdminAffiliateDisclosures().list()).rejects.toBe(error)
  })
})
