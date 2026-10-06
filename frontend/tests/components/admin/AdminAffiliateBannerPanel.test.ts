import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AdminAffiliateBannerPanel from '~/components/admin/AdminAffiliateBannerPanel.vue'
import type { AffiliateBannerDto, AffiliateBannerPage } from '~/types/affiliateBanner'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  uploadImage: vi.fn(),
}))

vi.mock('~/composables/useAdminAffiliateBanners', () => ({
  useAdminAffiliateBanners: () => apiMocks,
}))

vi.mock('~/composables/useApiBase', () => ({
  useApiBase: () => 'http://localhost:8000',
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

function banner(overrides: Partial<AffiliateBannerDto> = {}): AffiliateBannerDto {
  return {
    id: 'banner-a',
    provider: 'coupang',
    name: '쿠팡 배너',
    imageSourceType: 'url',
    imageAssetId: null,
    externalImageUrl: 'https://example.com/a.png',
    imageUrl: 'https://example.com/a.png',
    targetUrl: 'https://example.com/deal?a=1',
    altText: '쿠팡 배너',
    isEnabled: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides,
  }
}

function page(items: AffiliateBannerDto[], overrides: Partial<AffiliateBannerPage> = {}): AffiliateBannerPage {
  return {
    items,
    total: items.length,
    page: 1,
    totalPages: 1,
    ...overrides,
  }
}

describe('AdminAffiliateBannerPanel', () => {
  let listMock: ReturnType<typeof vi.fn>
  let getMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(apiMocks.list).mockReset()
    vi.mocked(apiMocks.get).mockReset()
    vi.mocked(apiMocks.create).mockReset()
    vi.mocked(apiMocks.update).mockReset()
    vi.mocked(apiMocks.setStatus).mockReset()
    vi.mocked(apiMocks.uploadImage).mockReset()
    listMock = apiMocks.list.mockResolvedValue(page([banner()]))
    getMock = apiMocks.get.mockResolvedValue(banner())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty, error, retry, filters, pagination, and keeps page filters on list calls', async () => {
    listMock
      .mockRejectedValueOnce(new Error('backend down'))
      .mockResolvedValueOnce(page([], { total: 0, totalPages: 1 }))
      .mockResolvedValueOnce(page([banner({ id: 'banner-b', provider: 'ali', isEnabled: true })], { page: 1, totalPages: 3 }))
      .mockResolvedValueOnce(page([banner({ id: 'banner-c', provider: 'ali' })], { page: 2, totalPages: 3 }))

    const wrapper = mount(AdminAffiliateBannerPanel)
    await flushPromises()

    expect(wrapper.find('[data-testid="affiliate-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="affiliate-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('등록된 배너가 없습니다')

    await wrapper.get('[data-testid="affiliate-provider-filter"]').setValue('ali')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith({ page: 1, limit: 10, provider: 'ali' })

    await wrapper.get('[data-testid="affiliate-status-filter"]').setValue('true')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith({ page: 1, limit: 10, provider: 'ali', isEnabled: true })

    await wrapper.get('[data-testid="affiliate-page-next"]').trigger('click')
    await flushPromises()
    expect(listMock).toHaveBeenLastCalledWith({ page: 2, limit: 10, provider: 'ali', isEnabled: true })
  })

  it('ignores stale list and get responses so old requests cannot replace the current row or editor', async () => {
    const slowList = deferred<AffiliateBannerPage>()
    const fastList = deferred<AffiliateBannerPage>()
    const slowGet = deferred<AffiliateBannerDto>()
    const fastGet = deferred<AffiliateBannerDto>()
    listMock.mockReset()
    getMock.mockReset()
    listMock
      .mockReturnValueOnce(slowList.promise)
      .mockReturnValueOnce(fastList.promise)
    getMock
      .mockReturnValueOnce(slowGet.promise)
      .mockReturnValueOnce(fastGet.promise)

    const wrapper = mount(AdminAffiliateBannerPanel)
    await wrapper.get('[data-testid="affiliate-provider-filter"]').setValue('ali')

    fastList.resolve(page([
      banner({ id: 'banner-b', name: '최신 배너', provider: 'ali' }),
    ]))
    await flushPromises()

    slowList.resolve(page([
      banner({ id: 'banner-a', name: '오래된 배너' }),
    ]))
    await flushPromises()

    expect(wrapper.text()).toContain('최신 배너')
    expect(wrapper.text()).not.toContain('오래된 배너')

    await wrapper.get('[data-testid="affiliate-row-banner-b"]').trigger('click')
    await wrapper.get('[data-testid="affiliate-new"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="affiliate-row-banner-b"]').trigger('click')

    fastGet.resolve(banner({ id: 'banner-b', name: '현재 선택' }))
    await flushPromises()
    slowGet.resolve(banner({ id: 'banner-b', name: '늦은 선택' }))
    await flushPromises()

    expect((wrapper.get('[data-testid="name"]').element as HTMLInputElement).value).toBe('현재 선택')
  })

  it('resolves relative upload thumbnails with api base and ignores late saved events from an old editor session', async () => {
    listMock.mockResolvedValue(page([banner({
      id: 'banner-a',
      imageSourceType: 'upload',
      imageUrl: '/api/images/affiliate-banners/a.png',
    })]))
    getMock.mockResolvedValue(banner({ id: 'banner-a', name: '편집 중' }))
    const wrapper = mount(AdminAffiliateBannerPanel)
    await flushPromises()

    expect(wrapper.get('[data-testid="affiliate-row-banner-a"] img').attributes('src')).toBe('http://localhost:8000/api/images/affiliate-banners/a.png')

    await wrapper.get('[data-testid="affiliate-row-banner-a"]').trigger('click')
    await flushPromises()
    const oldEditor = wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' })
    await wrapper.get('[data-testid="affiliate-new"]').trigger('click')
    await flushPromises()

    oldEditor.vm.$emit('saved', banner({ id: 'banner-a', name: '늦은 저장' }))
    await flushPromises()

    expect((wrapper.get('[data-testid="name"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('늦은 저장')

    wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).vm.$emit('saved', banner({ id: 'banner-a', name: '현재 세션으로 온 기존 저장' }))
    await flushPromises()

    expect((wrapper.get('[data-testid="name"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('현재 세션으로 온 기존 저장')
  })

  it('does not change selection, filters, page, or start a request when dirty navigation is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    listMock.mockResolvedValue(page([banner({ id: 'banner-a' })], { page: 1, totalPages: 2 }))
    getMock.mockResolvedValue(banner({ id: 'banner-a' }))

    const wrapper = mount(AdminAffiliateBannerPanel)
    await flushPromises()
    await wrapper.get('[data-testid="affiliate-row-banner-a"]').trigger('click')
    await flushPromises()

    wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).vm.$emit('dirty-change', true)
    await wrapper.get('[data-testid="affiliate-new"]').trigger('click')
    await wrapper.get('[data-testid="affiliate-provider-filter"]').setValue('ali')
    await wrapper.get('[data-testid="affiliate-page-next"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).props('banner')).toMatchObject({ id: 'banner-a' })
    expect((wrapper.get('[data-testid="affiliate-provider-filter"]').element as HTMLSelectElement).value).toBe('')
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('updates the selected row from editor saved dto and reports list refresh failure separately', async () => {
    listMock
      .mockResolvedValueOnce(page([banner({ id: 'banner-a', name: '이전 이름' })]))
      .mockRejectedValueOnce(new Error('refresh failed'))
    getMock.mockResolvedValue(banner({ id: 'banner-a', name: '이전 이름' }))
    const wrapper = mount(AdminAffiliateBannerPanel)
    await flushPromises()
    await wrapper.get('[data-testid="affiliate-row-banner-a"]').trigger('click')
    await flushPromises()

    wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).vm.$emit('saved', banner({ id: 'banner-a', name: '저장된 이름' }))
    await flushPromises()

    expect(wrapper.text()).toContain('저장된 이름')
    expect(wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).props('banner')).toMatchObject({ name: '저장된 이름' })
    expect(wrapper.text()).toContain('저장은 완료됐지만 목록을 새로고침하지 못했습니다')
  })

  it.each(['resolve', 'reject'] as const)('does not show refresh failure when saved refresh turns stale and later %s', async (finishMode) => {
    const saveRefresh = deferred<AffiliateBannerPage>()
    const filterRefresh = deferred<AffiliateBannerPage>()
    listMock.mockReset()
    listMock
      .mockResolvedValueOnce(page([banner({ id: 'banner-a', name: '초기 배너' })], { page: 1, totalPages: 2 }))
      .mockReturnValueOnce(saveRefresh.promise)
      .mockReturnValueOnce(filterRefresh.promise)
    getMock.mockResolvedValue(banner({ id: 'banner-a', name: '초기 배너' }))
    const wrapper = mount(AdminAffiliateBannerPanel)
    await flushPromises()
    await wrapper.get('[data-testid="affiliate-row-banner-a"]').trigger('click')
    await flushPromises()

    wrapper.findComponent({ name: 'AdminAffiliateBannerEditor' }).vm.$emit('saved', banner({ id: 'banner-a', name: '저장 직후 이름' }))
    await flushPromises()
    await wrapper.get('[data-testid="affiliate-provider-filter"]').setValue('ali')

    filterRefresh.resolve(page([banner({ id: 'banner-b', name: '필터 최신 배너', provider: 'ali' })]))
    await flushPromises()

    if (finishMode === 'resolve') {
      saveRefresh.resolve(page([banner({ id: 'banner-a', name: '늦은 저장 새로고침' })]))
    } else {
      saveRefresh.reject(new Error('late stale refresh failed'))
    }
    await flushPromises()

    expect(wrapper.text()).toContain('필터 최신 배너')
    expect(wrapper.text()).not.toContain('늦은 저장 새로고침')
    expect(wrapper.text()).not.toContain('저장은 완료됐지만 목록을 새로고침하지 못했습니다')
  })
})
