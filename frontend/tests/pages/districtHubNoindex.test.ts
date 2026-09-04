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

// 이 페이지는 useAsyncData 를 두 번 쓴다 — 지역 목록(`hub-regions-*`)과 area API.
// 페이지는 "지역 목록을 실제로 받아왔는가"로 확정 부재를 판정하므로(fail-open, #467),
// 목록까지 빈 값으로 stub 하면 area 결과와 무관하게 degraded 로 빠져 테스트 의도가 사라진다.
// 그래서 목록은 항상 정상 응답으로 두고, area 쪽만 케이스별로 바꾼다.
const REGION_ROWS = [
  { city: '서울', district: '강남구', slug: 'gangnam', lat: 37.5, lng: 127.0, bjdCode: '1168000000' },
]

function stubUseAsyncData(area: { data?: unknown; error?: unknown }) {
  vi.stubGlobal('useAsyncData', (key: string) => {
    const isRegions = key.startsWith('hub-regions-')
    const data = ref<any>(isRegions ? REGION_ROWS : (area.data ?? null))
    const error = ref<any>(isRegions ? null : (area.error ?? null))
    const result = { data, pending: ref(false), error, refresh: vi.fn() }
    return Object.assign(Promise.resolve(result), result)
  })
}

describe('district hub — noindex guard (Issue E)', () => {
  it('areaData가 null이면 useHead에 noindex 메타가 포함되어야 한다', async () => {
    // null 데이터 — area API 가 성공했는데 내용이 비어 있는 확정 빈값
    stubUseAsyncData({ data: null })

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
    stubUseAsyncData({ data: null, error: new Error('boom') })
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
    stubUseAsyncData({
      data: {
        data: {
          facilities: { total: 50, categories: { toilet: 10 }, topCategories: [] },
          realEstate: null,
        },
      },
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
