import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, onMounted } from 'vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).onMounted = onMounted

;(globalThis as any).createError = vi.fn((opts: unknown) => opts)
;(globalThis as any).useRequestEvent = () => undefined

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setAreaReportSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackRegionPageView: vi.fn() }),
}))

vi.mock('~/composables/useRegions', () => ({
  CITY_SLUG_MAP: { seoul: '서울' },
  useRegions: () => ({
    loadRegions: vi.fn().mockResolvedValue({}),
    syncFromHydration: vi.fn(),
    getCityName: (_slug: string) => '서울',
    getDistrictName: (_city: string, _district: string) => '강남구',
    getDistrictsByCity: (_city: string) => [{ slug: 'gangnam', name: '강남구' }],
  }),
}))

;(globalThis as any).useRoute = () => ({
  params: { city: 'seoul', district: 'gangnam' },
  query: {},
  fullPath: '/seoul/gangnam',
  path: '/seoul/gangnam',
  name: 'city-district',
  hash: '',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
})

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: true,
  PageHero: true,
  AdBanner: true,
  RegionRealEstatePrices: true,
  RegionFacilityCategoryGrid: true,
  RegionRealEstateCta: true,
  DataSourceSection: true,
}

describe('district hub — noindex guard (Issue E)', () => {
  it('areaData가 null이면 useHead에 noindex 메타가 포함되어야 한다', async () => {
    // null 데이터 — API 실패 시뮬레이션
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>(null)
      return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
        data,
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      })
    })

    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy

    vi.resetModules()
    const { default: DistrictHub } = await import('~/pages/[city]/[district]/index.vue')

    mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(DistrictHub) }) } }),
      { global: { stubs } },
    )
    await flushPromises()

    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]
      return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')),
    )
    expect(hasNoindex).toBe(true)

    ;(globalThis as any).useHead = vi.fn()
  })

  it('fetch 실패(error 있음)면 데이터가 null이어도 noindex가 없어야 한다 (fail-open)', async () => {
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>(null)
      const error = ref<any>(new Error('boom'))
      return Object.assign(Promise.resolve({ data, pending: ref(false), error, refresh: vi.fn() }), {
        data, pending: ref(false), error, refresh: vi.fn(),
      })
    })
    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy
    vi.resetModules()
    const { default: DistrictHub } = await import('~/pages/[city]/[district]/index.vue')
    mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(DistrictHub) }) } }),
      { global: { stubs } },
    )
    await flushPromises()
    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]; return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')))
    expect(hasNoindex).toBe(false)
    ;(globalThis as any).useHead = vi.fn()
  })

  it('areaData가 있으면 useHead에 noindex 메타가 없어야 한다', async () => {
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>({
        data: {
          facilities: { total: 50, categories: { toilet: 10 }, topCategories: [] },
          realEstate: null,
        },
      })
      return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
        data,
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      })
    })

    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy

    vi.resetModules()
    const { default: DistrictHub } = await import('~/pages/[city]/[district]/index.vue')

    mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(DistrictHub) }) } }),
      { global: { stubs } },
    )
    await flushPromises()

    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]
      return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')),
    )
    expect(hasNoindex).toBe(false)

    ;(globalThis as any).useHead = vi.fn()
  })
})
