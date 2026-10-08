import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminAffiliateBanners } from '~/composables/useAdminAffiliateBanners'
import type { AffiliateBannerDraft, AffiliateBannerDto } from '~/types/affiliateBanner'

const dto = (overrides: Partial<AffiliateBannerDto> = {}): AffiliateBannerDto => ({
  id: 'banner-1',
  provider: 'coupang',
  name: '쿠팡 배너',
  imageSourceType: 'url',
  imageAssetId: null,
  externalImageUrl: 'https://image.example.com/banner.png',
  imageUrl: 'https://image.example.com/banner.png',
  targetUrl: 'https://coupa.ng/a?x=%2B&x=1',
  altText: '쿠팡 배너',
  disclosureOverride: null,
  disclosureText: '쿠팡 테스트 기본',
  disclosureSource: 'provider',
  isEnabled: false,
  endDate: null,
  isExpired: false,
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  ...overrides,
})

const draft = (overrides: Partial<AffiliateBannerDraft> = {}): AffiliateBannerDraft => ({
  provider: 'coupang',
  name: '쿠팡 배너',
  imageSourceType: 'url',
  imageAssetId: null,
  externalImageUrl: 'https://image.example.com/banner.png',
  targetUrl: 'https://coupa.ng/a?x=%2B&x=1',
  altText: '쿠팡 배너',
  disclosureOverride: null,
  endDate: null,
  ...overrides,
})

beforeEach(() => {
  vi.mocked($fetch).mockReset()
  vi.stubGlobal('useApiBase', () => '')
})

describe('useAdminAffiliateBanners', () => {
  it('uploads bytes with authentication and an explicit raw content type', async () => {
    const uploaded = { imageAssetId: 'asset', imageUrl: '/api/images/affiliate-banners/asset.png' }
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: uploaded })
    const file = new File(['image-bytes'], 'banner.png', { type: 'image/png' })

    const result = await useAdminAffiliateBanners().uploadImage(file)

    expect(result).toEqual(uploaded)
    expect($fetch).toHaveBeenCalledWith('/api/admin/affiliate-banner-images', expect.objectContaining({
      method: 'POST',
      body: file,
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
    }))
  })

  it('returns data envelopes for list/get/create/update/status without rewriting affiliate URLs', async () => {
    const page = { items: [dto()], total: 1, page: 1, totalPages: 1 }
    vi.mocked($fetch)
      .mockResolvedValueOnce({ success: true, data: page })
      .mockResolvedValueOnce({ success: true, data: dto({ id: 'banner-2' }) })
      .mockResolvedValueOnce({ success: true, data: dto({ id: 'banner-3' }) })
      .mockResolvedValueOnce({ success: true, data: dto({ name: '수정' }) })
      .mockResolvedValueOnce({ success: true, data: dto({ isEnabled: true }) })

    const api = useAdminAffiliateBanners()
    await expect(api.list({ page: 2, limit: 10, provider: 'coupang', isEnabled: false })).resolves.toEqual(page)
    await expect(api.get('banner-2')).resolves.toMatchObject({ id: 'banner-2' })
    await expect(api.create(draft())).resolves.toMatchObject({ id: 'banner-3' })
    await expect(api.update('banner-1', { targetUrl: 'https://coupa.ng/a?x=%2B&x=1' })).resolves.toMatchObject({ name: '수정' })
    await expect(api.setStatus('banner-1', true)).resolves.toMatchObject({ isEnabled: true })

    expect($fetch).toHaveBeenNthCalledWith(1, '/api/admin/affiliate-banners?page=2&limit=10&provider=coupang&isEnabled=false', { credentials: 'include' })
    expect($fetch).toHaveBeenNthCalledWith(2, '/api/admin/affiliate-banners/banner-2', { credentials: 'include' })
    expect($fetch).toHaveBeenNthCalledWith(3, '/api/admin/affiliate-banners', {
      method: 'POST',
      body: draft(),
      credentials: 'include',
    })
    expect($fetch).toHaveBeenNthCalledWith(4, '/api/admin/affiliate-banners/banner-1', {
      method: 'PATCH',
      body: { targetUrl: 'https://coupa.ng/a?x=%2B&x=1' },
      credentials: 'include',
    })
    expect($fetch).toHaveBeenNthCalledWith(5, '/api/admin/affiliate-banners/banner-1/status', {
      method: 'PATCH',
      body: { isEnabled: true },
      credentials: 'include',
    })
  })

  it('sends disclosure overrides while omitting read-only disclosure fields and source-opposite image fields', async () => {
    vi.mocked($fetch)
      .mockResolvedValueOnce({ success: true, data: dto() })
      .mockResolvedValueOnce({ success: true, data: dto() })

    const api = useAdminAffiliateBanners()
    await api.create({
      ...draft({
        imageSourceType: 'upload',
        imageAssetId: 'asset-1',
        externalImageUrl: 'https://ignored.example.com/banner.png',
        disclosureOverride: '쿠팡 테스트 예외',
      }),
      isEnabled: true,
      imageUrl: 'ignored',
      disclosureText: '읽기 전용 계산 결과',
      disclosureSource: 'banner',
    } as AffiliateBannerDraft & Record<string, unknown>)
    await api.update('banner-1', {
      imageSourceType: 'url',
      imageAssetId: 'asset-2',
      externalImageUrl: 'https://image.example.com/new.png',
      disclosureOverride: null,
      disclosureText: '읽기 전용 계산 결과',
      disclosureSource: 'provider',
      extra: 'ignored',
    } as Partial<AffiliateBannerDraft> & Record<string, unknown>)

    expect(vi.mocked($fetch).mock.calls[0][1]).toMatchObject({
      body: expect.objectContaining({
        imageSourceType: 'upload',
        imageAssetId: 'asset-1',
        externalImageUrl: null,
        disclosureOverride: '쿠팡 테스트 예외',
      }),
    })
    expect(vi.mocked($fetch).mock.calls[0][1]?.body).not.toHaveProperty('isEnabled')
    expect(vi.mocked($fetch).mock.calls[0][1]?.body).not.toHaveProperty('imageUrl')
    expect(vi.mocked($fetch).mock.calls[0][1]?.body).not.toHaveProperty('disclosureText')
    expect(vi.mocked($fetch).mock.calls[0][1]?.body).not.toHaveProperty('disclosureSource')
    expect(vi.mocked($fetch).mock.calls[1][1]).toMatchObject({
      body: {
        imageSourceType: 'url',
        imageAssetId: null,
        externalImageUrl: 'https://image.example.com/new.png',
        disclosureOverride: null,
      },
    })
    expect(vi.mocked($fetch).mock.calls[1][1]?.body).not.toHaveProperty('disclosureText')
    expect(vi.mocked($fetch).mock.calls[1][1]?.body).not.toHaveProperty('disclosureSource')
  })

  it('omits absent end dates, preserves explicit null clears, and ignores readonly expiration fields', async () => {
    vi.mocked($fetch)
      .mockResolvedValueOnce({ success: true, data: dto({ name: '새 이름' }) })
      .mockResolvedValueOnce({ success: true, data: dto({ endDate: null, isExpired: false }) })
      .mockResolvedValueOnce({ success: true, data: dto({ endDate: '2026-10-15', isExpired: false }) })

    const api = useAdminAffiliateBanners()
    await api.update('banner-1', { name: '새 이름' })
    await api.update('banner-1', { endDate: null })
    await api.update('banner-1', {
      endDate: '2026-10-15',
      isExpired: true,
      expiresAt: '2026-10-15T15:00:00.000Z',
    } as Partial<AffiliateBannerDraft> & Record<string, unknown>)

    expect(vi.mocked($fetch).mock.calls[0][1]?.body).toEqual({ name: '새 이름' })
    expect(vi.mocked($fetch).mock.calls[0][1]?.body).not.toHaveProperty('endDate')
    expect(vi.mocked($fetch).mock.calls[1][1]?.body).toEqual({ endDate: null })
    expect(vi.mocked($fetch).mock.calls[2][1]?.body).toEqual({ endDate: '2026-10-15' })
    expect(vi.mocked($fetch).mock.calls[2][1]?.body).not.toHaveProperty('isExpired')
    expect(vi.mocked($fetch).mock.calls[2][1]?.body).not.toHaveProperty('expiresAt')
  })

  it('passes server errors through to the caller', async () => {
    const error = new Error('저장소 장애')
    vi.mocked($fetch).mockRejectedValueOnce(error)

    await expect(useAdminAffiliateBanners().uploadImage(new File(['x'], 'x.png'))).rejects.toBe(error)
  })
})
