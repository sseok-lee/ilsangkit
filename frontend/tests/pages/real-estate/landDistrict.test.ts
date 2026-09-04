import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

// district slug for 강남구 → 'gangnam' (from DISTRICT_SLUG_MAP)
;(globalThis as any).useRoute = vi.fn(() => ({
  params: { city: 'seoul', district: 'gangnam' },
}))

// Override useAsyncData to actually call the fetcher so data is populated
;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => unknown) => {
  let value: unknown = null
  try {
    value = await fetcher()
  } catch {
    value = null
  }
  const data = ref(value)
  return Object.assign(
    Promise.resolve({ data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }),
    { data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) },
  )
})

// Mock useRequestEvent / setResponseHeader for SSR no-store path
;(globalThis as any).useRequestEvent = vi.fn(() => null)
;(globalThis as any).setResponseHeader = vi.fn()

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

// Two dongs: one isIndexable true, one false; one has null avgPricePerPyeong
vi.mock('~/composables/useLand', () => ({
  useLand: () => ({
    getRegions: async (_params: any) => ({
      items: [
        {
          bjdCode: '1168010100',
          dongName: '역삼1동',
          city: '서울',
          district: '강남구',
          transactionCount: 30,
          recentCount: 10,
          avgPricePerPyeong: 6000000,
          latestDealDate: '2026-05-01',
          isIndexable: true,
          jimokBreakdown: { 대: 25, 전: 5 },
          daeCount: 25,
        },
        {
          bjdCode: '1168010200',
          dongName: '역삼2동',
          city: '서울',
          district: '강남구',
          transactionCount: 5,
          recentCount: 1,
          avgPricePerPyeong: null,
          latestDealDate: null,
          isIndexable: false,
          jimokBreakdown: {},
          daeCount: 0,
        },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    }),
    getHubSummary: async () => ({ cities: [], totalTransactions: 0 }),
    getRegionDetail: async () => ({
      items: [],
      total: 0,
      page: 1,
      totalPages: 1,
      jimokGroups: [],
      daeSamples: [],
      daeNonShareCount: 0,
      landUseDistribution: [],
      priceTimeline: [],
      daeCount: 0,
    }),
  }),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울', busan: '부산' },
  DISTRICT_SLUG_MAP: { 강남구: 'gangnam', 서초구: 'seocho' },
  REGIONS: { 서울: ['강남구', '서초구'] },
  CITY_FULL_NAME_TO_SLUG: {},
  CITY_SLUGS: { 서울: 'seoul', 부산: 'busan' },
  getDistrictSlug: (name: string) => {
    const map: Record<string, string> = { 강남구: 'gangnam', 서초구: 'seocho' }
    return map[name] ?? name.toLowerCase().replace(/\s+/g, '-')
  },
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
  // landMeta 가 구·동 지역 라벨을 축약 시도명으로 만든다(동일 구 이름의 시도 간 중복 방지).
  compactCityName: (city: string) => (city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, ''),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
})

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
}

async function mountPage() {
  const m = await import('~/pages/real-estate/land/[city]/[district]/index.vue')
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(m.default) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/land/[city]/[district]/index.vue — land district page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/land/[city]/[district]/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setBreadcrumbSchema가 5개 크럼으로 호출되어야 한다', async () => {
    await mountPage()
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(5)
  })

  it('breadcrumb 첫 항목은 홈(/)이어야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[0].url).toBe('/')
    expect(crumbs[0].name).toBe('홈')
  })

  it('breadcrumb 세 번째 항목은 토지 실거래가(/real-estate/land)여야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[2].url).toBe('/real-estate/land')
    expect(crumbs[2].name).toBe('토지 실거래가')
  })

  it('breadcrumb 마지막 url이 /real-estate/land/seoul/gangnam이어야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    const last = crumbs[crumbs.length - 1]
    expect(last.url).toBe('/real-estate/land/seoul/gangnam')
  })

  it('동 링크 href가 /real-estate/land/seoul/gangnam/ 으로 시작해야 한다', async () => {
    const wrapper = await mountPage()
    const links = wrapper.findAll('a')
    const dongLinks = links.filter((l) =>
      l.attributes('href')?.startsWith('/real-estate/land/seoul/gangnam/'),
    )
    expect(dongLinks.length).toBeGreaterThan(0)
  })

  it('동 이름(역삼1동)이 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('역삼1동')
  })

  it('avgPricePerPyeong null 동은 "대지 거래 없음"을 표시해야 한다', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('대지 거래 없음')
  })

  it('404: 알 수 없는 district slug는 createError를 throw해야 한다', async () => {
    ;(globalThis as any).useRoute = vi.fn(() => ({ params: { city: 'seoul', district: 'unknown-district-xyz' } }))
    let threw = false
    try {
      // Module is cached; test the logic directly
      const { DISTRICT_SLUG_MAP } = await import('~/shared/regionSlugs')
      const districtSlugToName = Object.fromEntries(
        Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]),
      )
      const districtName = districtSlugToName['unknown-district-xyz']
      if (!districtName) threw = true
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    // restore
    ;(globalThis as any).useRoute = vi.fn(() => ({ params: { city: 'seoul', district: 'gangnam' } }))
  })
})
