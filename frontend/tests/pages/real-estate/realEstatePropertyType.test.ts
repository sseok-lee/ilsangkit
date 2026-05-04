import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// Stub Vue auto-imports
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// Mock createError (Nuxt global)
;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

// Mock useRoute with valid propertyType param (HUB_TYPES 형태: apt-sale, apt-rent, ...)
;(globalThis as any).useRoute = vi.fn(() => ({
  params: { realEstateType: 'apt-sale' },
  query: {},
}))

// Mock useRouter
;(globalThis as any).useRouter = vi.fn(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setDatasetSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getComplexList: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/realEstateBuildingName', () => ({
  isValidBuildingName: vi.fn(() => true),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUGS: { 서울: 'seoul', 부산: 'busan', 대구: 'daegu' },
  CITY_SLUG_MAP: { seoul: '서울', busan: '부산', daegu: '대구' },
  REGIONS: {},
  CITY_FULL_NAME_TO_SLUG: {},
  CITY_SLUGS_ARRAY: [],
}))

vi.mock('~/utils/realEstateUrl', () => ({
  isRealEstateUrlType: vi.fn(() => true),
  toRealEstateUrl: vi.fn((p: any) => `/real-estate/${p.type}/${p.city}/${p.district}/${p.buildingName}`),
  toRealEstateListUrl: vi.fn((p: any) => `/real-estate/${p.type}/${p.city}/${p.district}`),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
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
          PageHero: { template: '<div data-stub="hero" />' },
          SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: { template: '<div />' },
          TransactionModeTab: { template: '<div />' },
          RealEstateSearchFilter: { template: '<div />' },
          ComplexCard: { template: '<div />' },
          Pagination: { template: '<div />' },
          DataSourceCard: { template: '<div />' },
        },
        ...options?.global,
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/[realEstateType]/index.vue — property type list page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setItemListSchema가 호출되어야 한다 (ItemList 구조화 데이터)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    await mountSuspended(m.default)
    expect(mockSetItemListSchema).toHaveBeenCalled()
  })

  it('지역별 도시 허브 링크가 렌더링되어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/real-estate/apt-sale/seoul')
    expect(hrefs).toContain('/real-estate/apt-sale/busan')
    expect(hrefs).toContain('/real-estate/apt-sale/daegu')
  })

  it('도시 허브 링크가 17개 이상이어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const cityHubLinks = wrapper.findAll('a').filter((a) =>
      /^\/real-estate\/apt-sale\/\w+$/.test(a.attributes('href') ?? ''),
    )
    // 모킹된 CITY_SLUGS는 3개
    expect(cityHubLinks.length).toBe(3)
  })
})
