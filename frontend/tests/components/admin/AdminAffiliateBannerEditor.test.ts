import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AdminAffiliateBannerEditor from '~/components/admin/AdminAffiliateBannerEditor.vue'
import type { AffiliateBannerDto } from '~/types/affiliateBanner'
import type { AffiliateProviderDisclosureDto } from '~/types/affiliateDisclosure'

const api = {
  create: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  uploadImage: vi.fn(),
}

vi.mock('~/composables/useAdminAffiliateBanners', () => ({
  useAdminAffiliateBanners: () => api,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const banner = (overrides: Partial<AffiliateBannerDto> = {}): AffiliateBannerDto => ({
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

const providerDisclosures: AffiliateProviderDisclosureDto[] = [
  { provider: 'coupang', defaultDisclosureText: '쿠팡 테스트 기본', updatedAt: null },
  { provider: 'ali', defaultDisclosureText: '알리 테스트 기본', updatedAt: null },
  { provider: 'toss', defaultDisclosureText: null, updatedAt: null },
]


function backendValidationError(details: unknown, message = '입력값이 올바르지 않습니다') {
  return {
    statusCode: 422,
    data: {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details,
      },
    },
  }
}

async function flush() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

async function uploadFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('[data-testid="upload-file"]')
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true,
  })
  await input.trigger('change')
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  vi.unstubAllGlobals()
})

describe('AdminAffiliateBannerEditor', () => {

  it('clears an end date explicitly and includes the edit in dirty state', async () => {
    api.update.mockResolvedValueOnce(banner({ endDate: null, isExpired: false }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({ endDate: '2026-10-15' }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="affiliate-end-date"]').setValue('')
    await flush()

    expect(wrapper.emitted('dirty-change')?.at(-1)).toEqual([true])
    await wrapper.get('form').trigger('submit')
    await flush()

    expect(api.update).toHaveBeenCalledWith('banner-1', expect.objectContaining({ endDate: null }))
  })

  it('keeps date-only edits through dirty, cancel, save failure, status, provider, and image changes', async () => {
    api.update.mockRejectedValueOnce(new Error('save failed'))
    api.setStatus.mockResolvedValueOnce(banner({ endDate: '2026-10-15', isEnabled: true }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({ endDate: '2026-10-15', isEnabled: false }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="affiliate-end-date"]').setValue('2026-10-16')
    expect(wrapper.emitted('dirty-change')?.at(-1)).toEqual([true])

    await wrapper.get('[data-testid="cancel-button"]').trigger('click')
    await flush()
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2026-10-15')

    await wrapper.get('[data-testid="affiliate-end-date"]').setValue('2026-10-16')
    await wrapper.get('form').trigger('submit')
    await flush()
    expect(wrapper.text()).toContain('저장하지 못했습니다')
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2026-10-16')

    await wrapper.get('[data-testid="affiliate-end-date"]').setValue('2026-10-15')
    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    await flush()
    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2026-10-15')

    await wrapper.get('[data-testid="provider"]').setValue('ali')
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2026-10-15')

    await wrapper.get('[data-testid="source-upload"]').setValue(true)
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2026-10-15')
  })

  it('shows past end date guidance and maps backend end date validation while keeping the draft', async () => {
    api.update.mockRejectedValueOnce(backendValidationError({
      fieldErrors: { endDate: ['Invalid date'] },
      formErrors: [],
    }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({ endDate: '2026-10-15' }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="affiliate-end-date"]').setValue('2020-01-01')
    expect(wrapper.get('[data-testid="affiliate-end-date-warning"]').text()).toContain('이미 지난 종료일입니다')
    await wrapper.get('form').trigger('submit')
    await flush()

    expect(wrapper.text()).toContain('유효한 종료일을 입력하세요')
    expect((wrapper.get('[data-testid="affiliate-end-date"]').element as HTMLInputElement).value).toBe('2020-01-01')
  })

  it('keeps the expired enable warning after the parent refreshes the saved banner prop', async () => {
    const refreshed = banner({ endDate: '2020-01-01', isExpired: true, isEnabled: true })
    api.setStatus.mockResolvedValueOnce(refreshed)
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({ endDate: '2020-01-01', isExpired: true, isEnabled: false }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    await flush()
    await wrapper.setProps({ banner: refreshed })
    await flush()

    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
    expect(wrapper.get('[data-testid="editor-message"]').text()).toBe('종료일이 지나 사용 설정을 켜도 광고가 노출되지 않습니다.')
  })
  it('clears an old provider override in the draft and restores it on cancel', async () => {
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({
          disclosureOverride: '쿠팡 테스트 예외',
          disclosureText: '쿠팡 테스트 예외',
          disclosureSource: 'banner',
        }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="provider"]').setValue('ali')

    expect(wrapper.get('[data-testid="disclosure-preview"]').text()).toBe('알리 테스트 기본')
    expect(api.update).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="cancel-button"]').trigger('click')
    await flush()

    expect(wrapper.get('[data-testid="disclosure-preview"]').text()).toBe('쿠팡 테스트 예외')
  })

  it('renders disclosure preview as plain text even when no image preview is available', async () => {
    const htmlText = '<img src=x onerror=alert(1)><a href="https://example.com">링크</a>'
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: null,
        providerDisclosures: [
          { provider: 'coupang', defaultDisclosureText: htmlText, updatedAt: null },
          providerDisclosures[1],
          providerDisclosures[2],
        ],
        disclosureLoadState: 'ready',
      },
    })

    expect(wrapper.find('[data-testid="preview-image"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="disclosure-preview"]').text()).toBe(htmlText)
    expect(wrapper.find('[data-testid="disclosure-preview"] img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="disclosure-preview"] a').exists()).toBe(false)
  })

  it('blocks empty individual disclosure saves without falling back to provider text', async () => {
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: null,
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="name"]').setValue('빈 개별 문구')
    await wrapper.get('[data-testid="external-image-url"]').setValue('https://image.example.com/banner.png')
    await wrapper.get('[data-testid="target-url"]').setValue('https://coupa.ng/empty')
    await wrapper.get('[data-testid="disclosure-mode-banner"]').setValue(true)
    await wrapper.get('[data-testid="disclosure-override"]').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(api.create).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('수익 고지 문구는 1~1,000자로 입력하세요')
    expect(wrapper.find('[data-testid="disclosure-preview"]').exists()).toBe(false)
  })


  it('maps backend disclosure validation envelopes on save to disclosure guidance and keeps the draft', async () => {
    api.create.mockRejectedValueOnce(backendValidationError({
      fieldErrors: { disclosureOverride: ['String must contain at most 1000 character(s)'] },
      formErrors: [],
    }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: null,
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="name"]').setValue('서버 검증 배너')
    await wrapper.get('[data-testid="external-image-url"]').setValue('https://image.example.com/banner.png')
    await wrapper.get('[data-testid="target-url"]').setValue('https://coupa.ng/server-validation')
    await wrapper.get('[data-testid="disclosure-mode-banner"]').setValue(true)
    await wrapper.get('[data-testid="disclosure-override"]').setValue('서버에서 거절한 문구')
    await wrapper.get('form').trigger('submit')
    await flush()

    expect(api.create).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('수익 고지 문구는 1~1,000자로 입력하세요')
    expect((wrapper.get('[data-testid="disclosure-override"]').element as HTMLTextAreaElement).value).toBe('서버에서 거절한 문구')
  })

  it('maps backend disclosure validation envelopes on status changes to disclosure guidance', async () => {
    api.setStatus.mockRejectedValueOnce(backendValidationError(
      undefined,
      '수익 고지 문구를 등록한 뒤 사용으로 설정하세요'
    ))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({ isEnabled: false }),
        providerDisclosures,
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    await flush()

    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
    expect(wrapper.text()).toContain('수익 고지 문구를 등록한 뒤 사용으로 설정하세요')
  })

  it('blocks enabling saved missing disclosures but allows disabling without disclosure settings', async () => {
    const saved = banner({
      isEnabled: true,
      disclosureOverride: null,
      disclosureText: null,
      disclosureSource: 'missing',
    })
    api.setStatus.mockResolvedValueOnce(banner({ isEnabled: false }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: saved,
        providerDisclosures: [],
        disclosureLoadState: 'error',
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('수익 고지 문구를 등록한 뒤 사용으로 설정하세요')

    await wrapper.get('[data-testid="status-disable"]').trigger('click')
    expect(api.setStatus).toHaveBeenCalledWith('banner-1', false)
  })


  it.each(['loading', 'error'] as const)('blocks stale provider-inherited enables while disclosure settings are %s', async (loadState) => {
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({
          isEnabled: false,
          disclosureOverride: null,
          disclosureText: '오래된 업체 기본 문구',
          disclosureSource: 'provider',
        }),
        providerDisclosures: [],
        disclosureLoadState: loadState,
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')

    expect(api.setStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('수익 고지 문구를 등록한 뒤 사용으로 설정하세요')
  })

  it('requires the current loaded provider default before enabling provider-inherited banners', async () => {
    api.setStatus.mockResolvedValueOnce(banner({ isEnabled: true }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({
          isEnabled: false,
          disclosureOverride: null,
          disclosureText: '오래된 업체 기본 문구',
          disclosureSource: 'provider',
        }),
        providerDisclosures: [],
        disclosureLoadState: 'ready',
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()

    await wrapper.setProps({
      providerDisclosures: [{ provider: 'coupang', defaultDisclosureText: null, updatedAt: null }],
      disclosureLoadState: 'ready',
    })
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()

    await wrapper.setProps({
      providerDisclosures: [{ provider: 'coupang', defaultDisclosureText: '현재 업체 기본 문구', updatedAt: null }],
      disclosureLoadState: 'ready',
    })
    await wrapper.get('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
  })

  it('still allows disabling provider-inherited banners when disclosure settings fail to load', async () => {
    api.setStatus.mockResolvedValueOnce(banner({ isEnabled: false }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: {
        banner: banner({
          isEnabled: true,
          disclosureOverride: null,
          disclosureText: '오래된 업체 기본 문구',
          disclosureSource: 'provider',
        }),
        providerDisclosures: [],
        disclosureLoadState: 'error',
      },
    })

    await wrapper.get('[data-testid="preview-image"]').trigger('load')
    await wrapper.get('[data-testid="status-disable"]').trigger('click')

    expect(api.setStatus).toHaveBeenCalledWith('banner-1', false)
  })

  it('keeps URL text changes idle until explicit preview and never renders a clickable affiliate link', async () => {
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="source-url"]').setValue(true)
    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/preview.png')
    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/a?x=%2B&x=1')

    expect(wrapper.find('[data-testid="preview-image"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="preview-link"]').exists()).toBe(false)

    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    expect(wrapper.find('[data-testid="preview-image"]').attributes('src')).toBe('https://image.example.com/preview.png')
    expect(wrapper.text()).toContain('광고·제휴 / 쿠팡')
    expect(wrapper.text()).toContain('https://coupa.ng/a?x=%2B&x=1')
    expect(wrapper.find('a[href="https://coupa.ng/a?x=%2B&x=1"]').exists()).toBe(false)
  })

  it('ignores stale image load and error events after a newer preview generation exists', async () => {
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="source-url"]').setValue(true)
    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/a.png')
    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    const imageA = wrapper.find('[data-testid="preview-image"]')

    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/b.png')
    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    await imageA.trigger('load')
    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지 확인 중')

    const imageB = wrapper.find('[data-testid="preview-image"]')
    await imageB.trigger('error')
    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지를 불러올 수 없습니다')

    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/a.png')
    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    await imageB.trigger('error')
    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지 확인 중')
  })

  it('applies only the latest successful upload to the draft and preview', async () => {
    const first = deferred<{ imageAssetId: string; imageUrl: string }>()
    const second = deferred<{ imageAssetId: string; imageUrl: string }>()
    api.uploadImage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="source-upload"]').setValue(true)
    await uploadFile(wrapper, new File(['a'], 'a.png', { type: 'image/png' }))
    await uploadFile(wrapper, new File(['b'], 'b.png', { type: 'image/png' }))

    first.resolve({ imageAssetId: 'asset-a', imageUrl: '/api/images/affiliate-banners/a.png' })
    await flush()
    expect(wrapper.find('[data-testid="preview-image"]').exists()).toBe(false)

    second.resolve({ imageAssetId: 'asset-b', imageUrl: '/api/images/affiliate-banners/b.png' })
    await flush()
    expect(wrapper.find('[data-testid="preview-image"]').attributes('src')).toBe('/api/images/affiliate-banners/b.png')

    await wrapper.find('[data-testid="name"]').setValue('업로드 배너')
    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/b')
    await wrapper.find('form').trigger('submit')
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      imageSourceType: 'upload',
      imageAssetId: 'asset-b',
      externalImageUrl: null,
    }))
  })

  it('releases upload busy state when an in-flight upload is invalidated by switching to URL source', async () => {
    const upload = deferred<{ imageAssetId: string; imageUrl: string }>()
    const saved = banner({ id: 'created-url', name: 'URL 배너' })
    api.uploadImage.mockReturnValueOnce(upload.promise)
    api.create.mockResolvedValueOnce(saved)
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="name"]').setValue('URL 배너')
    await wrapper.find('[data-testid="source-upload"]').setValue(true)
    await uploadFile(wrapper, new File(['a'], 'a.png', { type: 'image/png' }))
    await wrapper.find('[data-testid="source-url"]').setValue(true)
    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/url.png')
    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/url')

    upload.resolve({ imageAssetId: 'stale-asset', imageUrl: '/api/images/affiliate-banners/stale.png' })
    await flush()
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      imageSourceType: 'url',
      imageAssetId: null,
      externalImageUrl: 'https://image.example.com/url.png',
    }))
    expect(wrapper.emitted('saved')?.[0]?.[0]).toEqual(saved)
  })

  it('preserves draft values and dirty state when upload or save fails', async () => {
    api.uploadImage.mockRejectedValueOnce(new Error('upload failed'))
    api.create.mockRejectedValueOnce(new Error('save failed'))
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="name"]').setValue('실패해도 남는 배너')
    await wrapper.find('[data-testid="source-upload"]').setValue(true)
    await uploadFile(wrapper, new File(['x'], 'x.png', { type: 'image/png' }))
    await flush()

    expect(wrapper.text()).toContain('이미지를 업로드하지 못했습니다')
    expect((wrapper.find('[data-testid="name"]').element as HTMLInputElement).value).toBe('실패해도 남는 배너')

    await wrapper.find('[data-testid="source-url"]').setValue(true)
    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/banner.png')
    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/fail')
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(wrapper.text()).toContain('저장하지 못했습니다')
    expect((wrapper.find('[data-testid="name"]').element as HTMLInputElement).value).toBe('실패해도 남는 배너')
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toBe(true)
  })

  it('nulls the source-opposite image field and stops automatic alt updates after manual alt editing', async () => {
    api.create.mockResolvedValueOnce(banner({ id: 'new-banner', name: '새 배너', altText: '직접 쓴 설명' }))
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="name"]').setValue('처음 이름')
    expect((wrapper.find('[data-testid="alt-text"]').element as HTMLInputElement).value).toBe('처음 이름')

    await wrapper.find('[data-testid="alt-text"]').setValue('직접 쓴 설명')
    await wrapper.find('[data-testid="name"]').setValue('나중 이름')
    expect((wrapper.find('[data-testid="alt-text"]').element as HTMLInputElement).value).toBe('직접 쓴 설명')

    await wrapper.find('[data-testid="source-upload"]').setValue(true)
    api.uploadImage.mockResolvedValueOnce({ imageAssetId: 'asset-1', imageUrl: '/api/images/affiliate-banners/asset.png' })
    await uploadFile(wrapper, new File(['x'], 'x.png', { type: 'image/png' }))
    await flush()
    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/asset')
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '나중 이름',
      altText: '직접 쓴 설명',
      imageSourceType: 'upload',
      imageAssetId: 'asset-1',
      externalImageUrl: null,
    }))
  })

  it('blocks status changes while dirty and prevents duplicate submits', async () => {
    const saved = banner({ isEnabled: true })
    const saveDeferred = deferred<AffiliateBannerDto>()
    api.update.mockReturnValueOnce(saveDeferred.promise)
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: saved, providerDisclosures, disclosureLoadState: 'ready' },
    })

    await wrapper.find('[data-testid="name"]').setValue('수정 중')
    await wrapper.find('[data-testid="status-disable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('변경 내용을 먼저 저장하거나 취소하세요')

    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')
    expect(api.update).toHaveBeenCalledTimes(1)
    saveDeferred.resolve({ ...saved, name: '수정 중' })
    await flush()
  })

  it('blocks enable on a failed clean preview but allows disable', async () => {
    api.setStatus.mockResolvedValueOnce(banner({ isEnabled: false }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: banner({ isEnabled: true }) },
    })

    await wrapper.find('[data-testid="preview-image"]').trigger('error')

    await wrapper.find('[data-testid="status-enable"]').trigger('click')
    expect(wrapper.text()).toContain('이미지를 불러올 수 없습니다')

    await wrapper.find('[data-testid="status-disable"]').trigger('click')
    expect(api.setStatus).toHaveBeenCalledWith('banner-1', false)
  })

  it('keeps a saved banner preview unverified until its image load event before enabling', async () => {
    api.setStatus.mockResolvedValueOnce(banner({ isEnabled: true }))
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: banner({ isEnabled: false }), providerDisclosures, disclosureLoadState: 'ready' },
    })

    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지 확인 중')
    await wrapper.find('[data-testid="status-enable"]').trigger('click')

    expect(api.setStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('이미지를 불러올 수 없습니다')

    await wrapper.find('[data-testid="preview-image"]').trigger('load')
    await wrapper.find('[data-testid="status-enable"]').trigger('click')

    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
  })

  it('restores saved preview as unverified after cancelling source edits and waits for a new image load', async () => {
    api.setStatus.mockResolvedValueOnce(banner({ imageSourceType: 'upload', imageAssetId: 'asset-1', isEnabled: true }))
    const saved = banner({
      imageSourceType: 'upload',
      imageAssetId: 'asset-1',
      externalImageUrl: null,
      imageUrl: '/api/images/affiliate-banners/saved.png',
      isEnabled: false,
    })
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: saved, providerDisclosures, disclosureLoadState: 'ready' },
    })

    await wrapper.find('[data-testid="preview-image"]').trigger('error')
    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지를 불러올 수 없습니다')

    await wrapper.find('[data-testid="source-url"]').setValue(true)
    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/draft.png')
    await wrapper.find('[data-testid="cancel-button"]').trigger('click')
    await flush()

    expect(wrapper.find('[data-testid="preview-image"]').attributes('src')).toBe('/api/images/affiliate-banners/saved.png')
    expect(wrapper.find('[data-testid="preview-state"]').text()).toContain('이미지 확인 중')

    await wrapper.find('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="preview-image"]').trigger('load')
    await wrapper.find('[data-testid="status-enable"]').trigger('click')

    expect(api.setStatus).toHaveBeenCalledWith('banner-1', true)
  })

  it('prevents duplicate status requests while a status change is pending', async () => {
    const status = deferred<AffiliateBannerDto>()
    api.setStatus.mockReturnValueOnce(status.promise)
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: banner({ isEnabled: true }) },
    })

    await wrapper.find('[data-testid="status-disable"]').trigger('click')
    await wrapper.find('[data-testid="status-disable"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    expect(api.setStatus).toHaveBeenCalledTimes(1)
    expect(api.update).not.toHaveBeenCalled()

    status.resolve(banner({ isEnabled: false }))
    await flush()
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ isEnabled: false })
  })

  it('ignores stale status responses after the edited banner identity changes', async () => {
    const status = deferred<AffiliateBannerDto>()
    api.setStatus.mockReturnValueOnce(status.promise)
    const first = banner({ id: 'banner-1', name: '첫 배너', isEnabled: true })
    const second = banner({ id: 'banner-2', name: '둘째 배너', isEnabled: false })
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: first } })

    await wrapper.find('[data-testid="status-disable"]').trigger('click')
    await wrapper.setProps({ banner: second })
    status.resolve({ ...first, isEnabled: false, name: '늦은 첫 배너 응답' })
    await flush()

    expect((wrapper.find('[data-testid="name"]').element as HTMLInputElement).value).toBe('둘째 배너')
    expect(wrapper.emitted('saved')).toBeFalsy()
    expect(wrapper.find('[data-testid="save-button"]').attributes('disabled')).toBeUndefined()
  })

  it('preserves a failed preview after saving a disabled URL draft and blocks enabling it', async () => {
    const disabled = banner({ isEnabled: false })
    const saved = banner({
      isEnabled: false,
      externalImageUrl: 'https://image.example.com/bad.png',
      imageUrl: 'https://image.example.com/bad.png',
    })
    api.update.mockResolvedValueOnce(saved)
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: disabled } })

    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/bad.png')
    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    await wrapper.find('[data-testid="preview-image"]').trigger('error')
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(wrapper.emitted('saved')?.[0]?.[0]).toEqual(saved)
    await wrapper.find('[data-testid="status-enable"]').trigger('click')
    expect(api.setStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('이미지를 불러올 수 없습니다')
  })

  it('blocks saving a changed failed image while the saved banner is active', async () => {
    const wrapper = mount(AdminAffiliateBannerEditor, {
      props: { banner: banner({ isEnabled: true }) },
    })

    await wrapper.find('[data-testid="external-image-url"]').setValue('https://image.example.com/bad-active.png')
    await wrapper.find('[data-testid="preview-button"]').trigger('click')
    await wrapper.find('[data-testid="preview-image"]').trigger('error')
    await wrapper.find('form').trigger('submit')

    expect(api.update).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('사용 안 함으로 전환한 뒤 이미지를 바꾸세요')
  })

  it('does not mutate the banner prop and emits saved only after successful save', async () => {
    const original = banner()
    Object.freeze(original)
    const updated = banner({ name: '저장된 이름' })
    api.update.mockResolvedValueOnce(updated)
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: original } })

    await wrapper.find('[data-testid="name"]').setValue('저장된 이름')
    await wrapper.find('form').trigger('submit')
    await flush()

    expect(original.name).toBe('쿠팡 배너')
    expect(wrapper.emitted('saved')?.[0]?.[0]).toEqual(updated)
    expect(wrapper.emitted('dirty-change')?.at(-1)?.[0]).toBe(false)
  })

  it('shows a copy fallback message when Clipboard API write fails', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/copy')
    await wrapper.find('[data-testid="copy-target-url"]').trigger('click')
    await flush()

    expect(wrapper.text()).toContain('복사하지 못했습니다. 주소를 직접 복사하세요')
  })

  it('shows a copy fallback message when Clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: undefined,
    })
    const wrapper = mount(AdminAffiliateBannerEditor, { props: { banner: null } })

    await wrapper.find('[data-testid="target-url"]').setValue('https://coupa.ng/no-clipboard')
    await wrapper.find('[data-testid="copy-target-url"]').trigger('click')
    await flush()

    expect(wrapper.text()).toContain('복사하지 못했습니다. 주소를 직접 복사하세요')
  })
})
