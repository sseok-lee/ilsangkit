import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  explorationListHref,
  explorationMapHref,
} from '~/utils/explorationNavigation'
import type { ComplexInfo } from '~/types/realEstate'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).createError = (options: { statusCode: number; statusMessage: string }) => {
  const error = new Error(options.statusMessage) as Error & { statusCode: number }
  error.statusCode = options.statusCode
  return error
}
;(globalThis as any).navigateTo = vi.fn().mockResolvedValue(undefined)

const mocks = vi.hoisted(() => ({
  route: {
    path: '/real-estate/apt-sale/seoul/gangnam',
    params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam' },
    query: { page: '2' } as Record<string, string>,
  },
  getComplexList: vi.fn(),
  suppressAds: vi.fn(),
  markDegradedResponse: vi.fn(),
}))

;(globalThis as any).useRoute = vi.fn(() => mocks.route)
;(globalThis as any).useRouter = vi.fn(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({ getComplexList: mocks.getComplexList }),
}))

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    loadRegions: vi.fn().mockResolvedValue([
      { city: '서울', district: '강남구', slug: 'gangnam', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
    ]),
    syncFromHydration: vi.fn(),
    findRegionBySlug: (city: string, district: string) =>
      city === 'seoul' && district === 'gangnam'
        ? { city: '서울', district: '강남구', slug: 'gangnam', lat: 37.5172, lng: 127.0473, bjdCode: '11680' }
        : undefined,
  }),
}))

vi.mock('~/composables/useNationalComplexCount', () => ({
  useNationalComplexCount: () => ({ total: ref(100) }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useAdsPolicy', () => ({ suppressAds: mocks.suppressAds }))
vi.mock('~/composables/useDegradedResponse', () => ({ markDegradedResponse: mocks.markDegradedResponse }))
vi.mock('~/utils/realEstateBuildingName', () => ({ isValidBuildingName: () => true }))
vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

const pageTwoBuilding: ComplexInfo = {
  type: 'apt-sale',
  buildingName: '페이지2 단지',
  bjdCode: '1168011800',
  dongName: '도곡동',
  city: '서울',
  district: '강남구',
  latestPrice: 357000,
  transactionCount: 10,
  lat: 37.49,
  lng: 127.05,
  lastDealYear: 2026,
  lastDealMonth: 9,
  buildYear: 2006,
  latestDeals: {
    sale: {
      kind: 'sale',
      amount: 357000,
      deposit: null,
      monthlyRent: null,
      exclusiveArea: 84.92,
      floor: 16,
      dealYear: 2026,
      dealMonth: 9,
      dealDay: null,
    },
    jeonse: null,
    wolse: null,
  },
}

function installAsyncDataMock() {
  ;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => Promise<unknown>, options?: { default?: () => unknown }) => {
    try {
      const value = await fetcher()
      return {
        data: ref(value),
        status: ref('success'),
        error: ref(null),
        refresh: vi.fn(),
        pending: ref(false),
      }
    } catch (error) {
      return {
        data: ref(options?.default?.() ?? null),
        status: ref('error'),
        error: ref(error),
        refresh: vi.fn(),
        pending: ref(false),
      }
    }
  })
}

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render: () => h(Suspense, null, { default: () => h(component) }),
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav />' },
          PageHero: { template: '<header><slot /></header>' },
          SectionBlock: { template: '<section><slot name="heading" /><slot name="right" /><slot /></section>' },
          ExplorationFilters: { template: '<div data-testid="exploration-filters" />' },
          ExplorationBuildingRow: {
            props: ['building', 'mode'],
            template: '<article data-testid="exploration-row">{{ building.buildingName }} {{ mode }}</article>',
          },
          Pagination: { template: '<nav data-testid="pagination" />' },
          AdBanner: { template: '<div data-testid="ad" />' },
          EmptyState: { template: '<div><slot /></div>' },
          DataSourceSection: { template: '<div />' },
          RegionChips: { template: '<div />' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('exploration navigation helpers', () => {
  it('builds restored list URLs from Korean region names', () => {
    expect(explorationListHref('apt-rent', { city: '서울', district: '강남구' }))
      .toBe('/real-estate/apt-rent/seoul/gangnam')
  })

  it('uses the supplied map center and a documented national fallback', () => {
    expect(explorationMapHref('apt-sale', { lat: 37.5172, lng: 127.0473, level: 7 }))
      .toBe('/real-estate#type=apt-sale&level=7&lat=37.5172&lng=127.0473')
    expect(explorationMapHref('villa-rent', null))
      .toBe('/real-estate#type=villa-rent&level=13&lat=36.5&lng=127.8')
  })
})

describe('national, city, and district exploration lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installAsyncDataMock()
    mocks.route.path = '/real-estate/apt-sale/seoul/gangnam'
    mocks.route.params = { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam' }
    mocks.route.query = { page: '2' }
    mocks.getComplexList.mockResolvedValue({
      items: [pageTwoBuilding],
      total: 30,
      page: 2,
      totalPages: 2,
    })
  })

  it('hydrates district page 2 with the 24-row limit and renders the page-2 building row', async () => {
    const page = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(page.default)

    expect(mocks.getComplexList).toHaveBeenCalledWith('apt-sale', '서울', '강남구', undefined, 2, 24)
    expect(wrapper.get('[data-testid="exploration-row"]').text()).toContain('페이지2 단지')
    expect(wrapper.get('[data-testid="exploration-row"]').text()).toContain('sale')
  })

  it('keeps nationwide 15 and city 6 result limits', () => {
    const national = readFileSync(resolve(process.cwd(), 'pages/real-estate/[realEstateType]/index.vue'), 'utf8')
    const city = readFileSync(resolve(process.cwd(), 'pages/real-estate/[realEstateType]/[city]/index.vue'), 'utf8')

    expect(national).toMatch(/getComplexList\([^)]*initialPage\s*,\s*15\s*\)/s)
    expect(city).toMatch(/getComplexList\([^)]*1\s*,\s*6\s*\)/s)
    expect(city).toContain('markDegradedResponse()')
  })

  it('passes the current realEstateType into list row links', () => {
    const national = readFileSync(resolve(process.cwd(), 'pages/real-estate/[realEstateType]/index.vue'), 'utf8')
    const city = readFileSync(resolve(process.cwd(), 'pages/real-estate/[realEstateType]/[city]/index.vue'), 'utf8')
    const district = readFileSync(resolve(process.cwd(), 'pages/real-estate/[realEstateType]/[city]/[district]/index.vue'), 'utf8')

    expect(national).toContain(':real-estate-type="apiSlug"')
    expect(city).toContain(':real-estate-type="realEstateTypeParam"')
    expect(district).toContain(':real-estate-type="realEstateType"')
  })

  it('uses the shared exploration row and filters on all three list roles', () => {
    for (const relativePath of [
      'pages/real-estate/[realEstateType]/index.vue',
      'pages/real-estate/[realEstateType]/[city]/index.vue',
      'pages/real-estate/[realEstateType]/[city]/[district]/index.vue',
    ]) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8')
      expect(source).toContain('<ExplorationFilters')
      expect(source).toContain('<ExplorationBuildingRow')
      expect(source).not.toContain('<ComplexCard')
    }
  })

  it('shows an explicit city-list error instead of converting failure to zero results', async () => {
    mocks.route.path = '/real-estate/apt-sale/seoul'
    mocks.route.params = { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam' }
    mocks.route.query = {}
    mocks.getComplexList.mockRejectedValueOnce(new Error('city unavailable'))

    const page = await import('~/pages/real-estate/[realEstateType]/[city]/index.vue')
    const wrapper = await mountSuspended(page.default)

    expect(wrapper.text()).toContain('주요 건물을 불러오지 못했습니다')
    expect(wrapper.text()).not.toContain('주요 건물이 없습니다')
  })

  it('removes sample average hero and metadata calculations from the district page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'pages/real-estate/[realEstateType]/[city]/[district]/index.vue'),
      'utf8',
    )

    expect(source).not.toContain('avgLatestPrice')
    expect(source).not.toContain('평균 시세')
    expect(source).not.toContain('formatKoreanPrice')
  })
})
