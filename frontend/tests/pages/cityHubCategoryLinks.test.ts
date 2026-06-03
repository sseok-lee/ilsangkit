import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, onMounted } from 'vue'
import CityHub from '~/pages/[city]/index.vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).onMounted = onMounted

// createError: seoul은 CITY_SLUG_MAP에 있으므로 실제로 throw 되지 않음 — 객체 반환만
;(globalThis as any).createError = vi.fn((opts: unknown) => opts)

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setAreaReportSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackRegionPageView: vi.fn() }),
}))

// Override the global useRoute stub (set in setup.ts) to provide city param
;(globalThis as any).useRoute = () => ({ params: { city: 'seoul' }, query: {}, fullPath: '/seoul', path: '/seoul', name: 'city', hash: '', matched: [], meta: {}, redirectedFrom: undefined })

vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
  const data = ref<any>({
    data: {
      districts: [{ slug: 'gangnam-gu', name: '강남구', facilityTotal: 100 }],
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

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: true,
  PageHero: true,
  AdBanner: true,
  RegionRealEstatePrices: true,
  RegionRealEstateCta: true,
  RecentGuides: true,
  DataSourceSection: true,
  ClientOnly: { template: '<div><slot /></div>' },
}

async function mountSuspended() {
  const w = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(CityHub) }) } }),
    { global: { stubs } },
  )
  await flushPromises()
  return w
}

describe('지역 허브 카테고리 바로가기', () => {
  it('각 카테고리를 /{cat}?city={slug} 링크로 렌더한다', async () => {
    const w = await mountSuspended()
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/pharmacy?city=seoul')
    expect(hrefs).toContain('/hospital?city=seoul')
    expect(hrefs).toContain('/parking?city=seoul')
  })
})
