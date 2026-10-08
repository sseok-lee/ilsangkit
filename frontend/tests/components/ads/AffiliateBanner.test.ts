import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import AffiliateBanner from '~/components/ads/AffiliateBanner.vue'

vi.mock('~/composables/useApiBase', () => ({
  useApiBase: () => 'https://api.example.com',
}))

type PublicBanner = {
  id: string
  provider: 'coupang' | 'ali' | 'toss'
  imageUrl: string
  targetUrl: string
  altText: string
  disclosureText: string
  expiresAt: string | null
}

const route = reactive({ path: '/hospital/example' })

vi.stubGlobal('useRoute', () => route)

enableAutoUnmount(afterEach)

type TestGlobal = typeof globalThis & {
  $fetch: Mock
  __resetUseState?: () => void
  useState: <T>(key: string, init?: () => T) => { value: T }
}

const testGlobal = globalThis as TestGlobal

function banner(overrides: Partial<PublicBanner> = {}): PublicBanner {
  return {
    id: 'banner-1',
    provider: 'coupang',
    imageUrl: 'https://cdn.example.com/banner.png',
    targetUrl: 'https://link.example.com/product',
    altText: '추천 상품',
    disclosureText: '쿠팡 파트너스 활동의 일환으로\n일정액의 수수료를 제공받습니다.',
    expiresAt: null,
    ...overrides,
  }
}

function envelope(data: PublicBanner | null) {
  return { success: true, data, serverTime: '2026-10-15T14:59:00.000Z' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })
  return { promise, resolve, reject }
}

async function flushAsync() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function stubViewport(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const media = {
    matches,
    media: '(max-width: 767px)',
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    }),
    removeEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    }),
    dispatch(nextMatches: boolean) {
      media.matches = nextMatches
      const event = { matches: nextMatches, media: media.media } as MediaQueryListEvent
      listeners.forEach(listener => listener(event))
    },
  } as unknown as MediaQueryList & { dispatch(nextMatches: boolean): void }

  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media))
  return media
}

function fetchMock(): Mock {
  return testGlobal.$fetch
}

describe('AffiliateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.path = '/hospital/example'
    fetchMock().mockReset()
    fetchMock().mockResolvedValue(envelope(banner()))
    testGlobal.__resetUseState?.()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.stubGlobal('useRoute', () => route)
    testGlobal.__resetUseState?.()
  })

  it('renders the plain disclosure above the image on mobile', async () => {
    stubViewport(true)
    const wrapper = mount(AffiliateBanner)

    await flushAsync()

    const disclosure = wrapper.get('[data-testid="affiliate-disclosure"]')
    const image = wrapper.get('[data-testid="affiliate-image"]')
    expect(wrapper.get('[data-testid="affiliate-banner"]').element.compareDocumentPosition(disclosure.element)).toBeTruthy()
    expect(disclosure.element.compareDocumentPosition(image.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(disclosure.classes()).toEqual(expect.arrayContaining(['whitespace-pre-line', 'break-words']))
    expect(disclosure.text()).toContain('쿠팡 파트너스 활동의 일환으로')
    expect(disclosure.text()).toContain('일정액의 수수료를 제공받습니다.')
  })

  it('does not render space or request the API at the 768px desktop boundary', async () => {
    stubViewport(false)
    const wrapper = mount(AffiliateBanner)

    await flushAsync()

    expect(wrapper.html()).toBe('<!--v-if-->')
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('keeps disclosure text escaped and preserves line breaks as text', async () => {
    stubViewport(true)
    fetchMock().mockResolvedValueOnce(envelope(banner({
      disclosureText: '첫 줄\n<strong>광고</strong><script>alert(1)</script>',
    })))

    const wrapper = mount(AffiliateBanner)
    await flushAsync()

    const disclosure = wrapper.get('[data-testid="affiliate-disclosure"]')
    expect(disclosure.html()).toContain('&lt;strong&gt;광고&lt;/strong&gt;')
    expect(disclosure.html()).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(disclosure.text()).toContain('첫 줄\n<strong>광고</strong>')
  })

  it('links with sponsored safe attributes and resolves uploaded images through api base', async () => {
    stubViewport(true)
    fetchMock().mockResolvedValueOnce(envelope(banner({
      imageUrl: '/api/images/affiliate-banners/a.png',
    })))

    const wrapper = mount(AffiliateBanner)
    await flushAsync()

    const link = wrapper.get('[data-testid="affiliate-link"]')
    const image = wrapper.get('[data-testid="affiliate-image"]')
    expect(link.attributes('href')).toBe('https://link.example.com/product')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('sponsored nofollow noopener noreferrer')
    expect(image.attributes('src')).toBe('https://api.example.com/api/images/affiliate-banners/a.png')
    expect(image.attributes('alt')).toBe('추천 상품')
  })

  it.each([
    ['null response', () => Promise.resolve(envelope(null))],
    ['API error', () => Promise.reject(new Error('network'))],
  ])('hides the full area on %s', async (_name, response) => {
    stubViewport(true)
    fetchMock().mockImplementationOnce(response)

    const wrapper = mount(AffiliateBanner)
    await flushAsync()

    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('hides the full area when the image fails', async () => {
    stubViewport(true)
    const wrapper = mount(AffiliateBanner)
    await flushAsync()

    await wrapper.get('[data-testid="affiliate-image"]').trigger('error')
    await nextTick()

    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('does not fetch when ads are suppressed or the path is ad-free', async () => {
    stubViewport(true)
    testGlobal.useState('ads:suppressed', () => false).value = true
    const suppressed = mount(AffiliateBanner)
    await flushAsync()

    route.path = '/real-estate'
    testGlobal.useState('ads:suppressed', () => false).value = false
    const adFree = mount(AffiliateBanner)
    await flushAsync()

    expect(suppressed.html()).toBe('<!--v-if-->')
    expect(adFree.html()).toBe('<!--v-if-->')
    expect(fetchMock()).not.toHaveBeenCalled()
  })

  it('invalidates stale route responses and requests a fresh banner', async () => {
    stubViewport(true)
    const slow = deferred<{ success: true, data: PublicBanner }>()
    const fast = deferred<{ success: true, data: PublicBanner }>()
    fetchMock()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)

    const wrapper = mount(AffiliateBanner)
    await flushAsync()
    expect(fetchMock()).toHaveBeenCalledTimes(1)

    route.path = '/pharmacy/example'
    await flushAsync()
    expect(fetchMock()).toHaveBeenCalledTimes(2)

    fast.resolve(envelope(banner({ id: 'fast', altText: '새 배너' })))
    await flushAsync()
    slow.resolve(envelope(banner({ id: 'slow', altText: '오래된 배너' })))
    await flushAsync()

    expect(wrapper.get('[data-testid="affiliate-image"]').attributes('alt')).toBe('새 배너')
    expect(wrapper.text()).not.toContain('오래된 배너')
  })

  it('aborts and hides when resizing from mobile to desktop', async () => {
    const media = stubViewport(true)
    const request = deferred<{ success: true, data: PublicBanner }>()
    fetchMock().mockReturnValueOnce(request.promise)

    const wrapper = mount(AffiliateBanner)
    media.dispatch(false)
    await flushAsync()

    request.resolve(envelope(banner()))
    await flushAsync()

    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('removes viewport listeners and ignores responses after unmount', async () => {
    const media = stubViewport(true)
    const request = deferred<{ success: true, data: PublicBanner }>()
    fetchMock().mockReturnValueOnce(request.promise)

    const wrapper = mount(AffiliateBanner)
    wrapper.unmount()
    request.resolve(envelope(banner()))
    await flushAsync()

    expect(media.removeEventListener).toHaveBeenCalled()
  })

  it('hides at expiry without rotating even when the device wall clock is wrong', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let monotonicNow = 0
    const clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    const wallSpy = vi.spyOn(Date, 'now').mockReturnValue(0)
    stubViewport(true)
    fetchMock().mockResolvedValueOnce({
      success: true,
      data: banner({ expiresAt: '2026-10-15T15:00:00.000Z' }),
      serverTime: '2026-10-15T14:59:59.000Z',
    })
    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(true)
      monotonicNow = 1000
      await vi.advanceTimersByTimeAsync(1000)
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="affiliate-disclosure"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="affiliate-link"]').exists()).toBe(false)
      expect(fetchMock()).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
      clockSpy.mockRestore()
      wallSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('hides a response that is already expired when it arrives late', async () => {
    let monotonicNow = 0
    const clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    stubViewport(true)
    const request = deferred<{ success: true, data: PublicBanner, serverTime: string }>()
    fetchMock().mockReturnValueOnce(request.promise)

    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      monotonicNow = 1000
      request.resolve({
        success: true,
        data: banner({ expiresAt: '2026-10-15T15:00:00.000Z' }),
        serverTime: '2026-10-15T14:59:59.000Z',
      })
      await flushAsync()

      expect(wrapper.html()).toBe('<!--v-if-->')
      expect(fetchMock()).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
      clockSpy.mockRestore()
    }
  })

  it('keeps very long expiries visible through timer chunks and hides at the final boundary', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let monotonicNow = 0
    const clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    stubViewport(true)
    fetchMock().mockResolvedValueOnce({
      success: true,
      data: banner({ expiresAt: '2026-11-15T14:59:59.648Z' }),
      serverTime: '2026-10-15T14:59:59.000Z',
    })
    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(true)

      monotonicNow = 2_147_483_647
      await vi.advanceTimersByTimeAsync(2_147_483_647)
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(true)

      monotonicNow = 2_678_400_648
      await vi.advanceTimersByTimeAsync(530_917_001)
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(false)
      expect(fetchMock()).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
      clockSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('ignores old expiry timers after a route change replaces the banner', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let monotonicNow = 0
    const clockSpy = vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow)
    stubViewport(true)
    fetchMock()
      .mockResolvedValueOnce({
        success: true,
        data: banner({ id: 'old', altText: '오래된 배너', expiresAt: '2026-10-15T15:00:00.000Z' }),
        serverTime: '2026-10-15T14:59:59.000Z',
      })
      .mockResolvedValueOnce({
        success: true,
        data: banner({ id: 'new', altText: '새 배너', expiresAt: '2026-10-15T15:00:10.000Z' }),
        serverTime: '2026-10-15T14:59:59.500Z',
      })
    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      route.path = '/pharmacy/example'
      await flushAsync()
      expect(wrapper.get('[data-testid="affiliate-image"]').attributes('alt')).toBe('새 배너')

      monotonicNow = 1000
      await vi.advanceTimersByTimeAsync(1000)
      await flushAsync()

      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="affiliate-image"]').attributes('alt')).toBe('새 배너')
    } finally {
      wrapper.unmount()
      clockSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('invalidates while hidden and coalesces visibility and BFCache resume reloads', async () => {
    let visibilityState = 'visible'
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState as DocumentVisibilityState)
    stubViewport(true)
    const resume = deferred<{ success: true, data: PublicBanner, serverTime: string }>()
    fetchMock()
      .mockResolvedValueOnce(envelope(banner({ id: 'initial' })))
      .mockReturnValueOnce(resume.promise)

    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      expect(wrapper.find('[data-testid="affiliate-banner"]').exists()).toBe(true)

      visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      await flushAsync()
      expect(wrapper.html()).toBe('<!--v-if-->')
      expect(fetchMock()).toHaveBeenCalledTimes(1)

      visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      const pageShow = new Event('pageshow') as PageTransitionEvent
      Object.defineProperty(pageShow, 'persisted', { value: true })
      window.dispatchEvent(pageShow)
      await flushAsync()
      expect(fetchMock()).toHaveBeenCalledTimes(2)

      resume.resolve(envelope(banner({ id: 'resumed', altText: '복귀 배너' })))
      await flushAsync()
      expect(wrapper.get('[data-testid="affiliate-image"]').attributes('alt')).toBe('복귀 배너')
    } finally {
      wrapper.unmount()
      visibilitySpy.mockRestore()
    }
  })

  it('does not request again on initial pageshow or after unmount listeners are removed', async () => {
    let visibilityState = 'visible'
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState as DocumentVisibilityState)
    const documentAddSpy = vi.spyOn(document, 'addEventListener')
    const documentRemoveSpy = vi.spyOn(document, 'removeEventListener')
    const windowAddSpy = vi.spyOn(window, 'addEventListener')
    const windowRemoveSpy = vi.spyOn(window, 'removeEventListener')
    stubViewport(true)
    fetchMock().mockResolvedValueOnce(envelope(banner()))

    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      const pageShow = new Event('pageshow') as PageTransitionEvent
      Object.defineProperty(pageShow, 'persisted', { value: false })
      window.dispatchEvent(pageShow)
      await flushAsync()
      expect(fetchMock()).toHaveBeenCalledTimes(1)

      wrapper.unmount()
      visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      const persistedPageShow = new Event('pageshow') as PageTransitionEvent
      Object.defineProperty(persistedPageShow, 'persisted', { value: true })
      window.dispatchEvent(persistedPageShow)
      await flushAsync()

      expect(fetchMock()).toHaveBeenCalledTimes(1)
      expect(documentAddSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(documentRemoveSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(windowAddSpy).toHaveBeenCalledWith('pageshow', expect.any(Function))
      expect(windowRemoveSpy).toHaveBeenCalledWith('pageshow', expect.any(Function))
    } finally {
      visibilitySpy.mockRestore()
      documentAddSpy.mockRestore()
      documentRemoveSpy.mockRestore()
      windowAddSpy.mockRestore()
      windowRemoveSpy.mockRestore()
    }
  })

  it('stays hidden when resume fetch fails', async () => {
    let visibilityState = 'visible'
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState as DocumentVisibilityState)
    stubViewport(true)
    fetchMock()
      .mockResolvedValueOnce(envelope(banner()))
      .mockRejectedValueOnce(new Error('resume failed'))

    const wrapper = mount(AffiliateBanner)
    try {
      await flushAsync()
      visibilityState = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
      visibilityState = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      await flushAsync()

      expect(wrapper.html()).toBe('<!--v-if-->')
      expect(fetchMock()).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
      visibilitySpy.mockRestore()
    }
  })
})
