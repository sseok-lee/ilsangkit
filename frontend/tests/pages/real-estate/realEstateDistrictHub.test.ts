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

// Mock useRoute with valid params
;(globalThis as any).useRoute = vi.fn(() => ({
  params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam' },
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

vi.mock('~/utils/realEstateBuildingName', () => ({
  isValidBuildingName: vi.fn(() => true),
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
          SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
          AdBanner: { template: '<div />' },
          ComplexCard: { template: '<div />' },
          Pagination: { template: '<div />' },
        },
        ...options?.global,
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/[realEstateType]/[city]/[district]/index.vue — district list page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setItemListSchema가 호출되어야 한다 (ItemList 구조화 데이터)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    await mountSuspended(m.default)
    expect(mockSetItemListSchema).toHaveBeenCalled()
  })

  it('setBreadcrumbSchema가 5단계로 호출되어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    await mountSuspended(m.default)
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(5)
  })

  it('breadcrumb item[2]가 canonical realEstateType URL을 가리켜야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[2].url).toBe('/real-estate/apt-sale')
  })

  it('breadcrumb item[3]이 city hub URL을 가리켜야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[3].url).toContain('seoul')
  })

  it('breadcrumb 마지막 항목이 구/군 이름이어야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    await mountSuspended(m.default)
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[4].name).toBe('강남구')
  })
})
