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

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
  query: {},
}))

;(globalThis as any).useRouter = vi.fn(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()
const mockSetBuildingPlaceSchema = vi.fn()
const mockSetRealEstateListingSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setBuildingPlaceSchema: mockSetBuildingPlaceSchema,
    setRealEstateListingSchema: mockSetRealEstateListingSchema,
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchTransactions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, stats: null }),
    getTransactionStats: vi.fn().mockResolvedValue(null),
    getBuildingInfo: vi.fn().mockResolvedValue(null),
    getAreaGroups: vi.fn().mockResolvedValue([]),
    getComplexList: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }),
  }),
}))

vi.mock('~/composables/useApiBase', () => ({
  useApiBase: () => '',
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({
    trackBuildingView: vi.fn(),
    trackDirectionsClick: vi.fn(),
    trackShareClick: vi.fn(),
  }),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울' },
  DISTRICT_SLUG_MAP: { '강남구': 'gangnam', '강북구': 'gangbuk' },
  REGIONS: { '서울': ['강남구', '강북구'] },
  CITY_FULL_NAME_TO_SLUG: {},
  CITY_SLUGS: {},
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/realEstateUrl', () => ({
  isRealEstateUrlType: vi.fn(() => true),
  toRealEstateUrl: vi.fn((p: any) => `/real-estate/${p.type}/${p.city}/${p.district}/${p.buildingName}`),
  toRealEstateListUrl: vi.fn((p: any) => `/real-estate/${p.type}/${p.city}/${p.district}`),
}))

vi.mock('~/utils/realEstateNoindex', () => ({
  shouldNoindexRealEstateDetail: vi.fn(() => false),
}))

vi.mock('~/utils/realEstateDetailData', () => ({
  hasUsableRealEstateDetailData: vi.fn(() => false),
}))

vi.mock('~/utils/dataSource', () => ({
  REAL_ESTATE_DATA_SOURCE: { name: '국토교통부', url: 'https://rtms.molit.go.kr' },
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
  mockSetBuildingPlaceSchema.mockClear()
  mockSetRealEstateListingSchema.mockClear()
})

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          PageHero: { template: '<section><h1>{{ title }}</h1></section>', props: ['eyebrow', 'title', 'description', 'stats'] },
          SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: { template: '<div />' },
          ComplexCard: { template: '<div />' },
          Pagination: { template: '<div />' },
          DataSourceSection: { template: '<div />' },
          RelatedGuides: { template: '<div />' },
          FacilityMap: { template: '<div />' },
          TransactionModeTab: { template: '<div />' },
        },
        ...options?.global,
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/[realEstateType]/[city]/[district]/[buildingName].vue — building detail', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    expect(m.default).toBeDefined()
  })

  it('setBreadcrumbSchema가 6단계로 호출되어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(6)
  })

  it('breadcrumb item[2]가 canonical realEstateType URL을 가리켜야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[2].url).toBe('/real-estate/apt-sale')
  })

  it('breadcrumb item[3]이 city hub URL을 가리켜야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[3].url).toContain('seoul')
  })

  it('breadcrumb item[4]가 district list URL을 가리켜야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[4].url).toContain('강남구')
  })

  it('breadcrumb 마지막 항목이 건물명이어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[5].name).toBe('반포자이')
  })

  // ---------------- SEO 회귀 가드 (PR #2 Step 1: 듀얼 분기 통합 후) ----------------
  it('건물명 H1이 단 1개만 존재 (PageHero 단일 진입점)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('반포자이')
  })

  it('Breadcrumb이 viewport에 무관하게 단일 렌더 (hidden md:block 제거됨)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const breadcrumbs = wrapper.findAll('[data-stub="breadcrumb"]')
    expect(breadcrumbs.length).toBe(1)
  })

  it('noindex 조건(buildingInfo=null)에서도 canonical link가 출력되어야 한다', async () => {
    // shouldNoindexRealEstateDetail이 true를 반환하도록 재모킹
    const { shouldNoindexRealEstateDetail } = await import('~/utils/realEstateNoindex')
    vi.mocked(shouldNoindexRealEstateDetail).mockReturnValue(true)

    ;(globalThis as any).useHead = vi.fn()

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)

    const useHeadSpy = (globalThis as any).useHead as ReturnType<typeof vi.fn>
    expect(useHeadSpy).toHaveBeenCalled()
    const headArg = useHeadSpy.mock.calls[useHeadSpy.mock.calls.length - 1][0]
    const resolved = typeof headArg === 'function' ? headArg() : headArg
    expect(resolved.link).toEqual(
      expect.arrayContaining([expect.objectContaining({ rel: 'canonical' })]),
    )

    // 복원
    vi.mocked(shouldNoindexRealEstateDetail).mockReturnValue(false)
  })
})
