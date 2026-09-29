import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

const routerPush = vi.fn()
const routerReplace = vi.fn()

;(globalThis as any).useRouter = vi.fn(() => ({
  replace: routerReplace,
  push: routerPush,
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()
const mockSetBuildingPlaceSchema = vi.fn()
const mockSetRealEstateListingSchema = vi.fn()
const mockSetFilters = vi.fn()
const mockGoToPage = vi.fn()
const mockRefresh = vi.fn()
const mockRefreshOverview = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setBuildingPlaceSchema: mockSetBuildingPlaceSchema,
    setRealEstateListingSchema: mockSetRealEstateListingSchema,
    setDetailProvenance: vi.fn(),
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

vi.mock('~/composables/useRealEstateDetail', async () => {
  const { ref } = await import('vue')
  return {
    useRealEstateDetail: () => ({
      overview: ref(null),
      snapshot: ref({
        filters: {
          bjdCode: '1168010100',
          buildingName: '반포자이',
          mode: 'sale',
          months: 6,
          area: '84.90',
          deposit: null,
        },
        options: { areas: ['84.90'], deposits: [] },
        points: [],
        window: { from: '2026-04-01', to: '2026-09-29' },
        table: { items: [], total: 0, page: 1, totalPages: 0 },
      }),
      table: ref({ items: [], total: 0, page: 1, totalPages: 0 }),
      pending: ref(false),
      tablePending: ref(false),
      error: ref(null),
      overviewError: ref(null),
      tableError: ref(null),
      announcement: ref(''),
      setFilters: mockSetFilters,
      goToPage: mockGoToPage,
      refresh: mockRefresh,
      refreshOverview: mockRefreshOverview,
    }),
  }
})

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
  compactCityName: (city: string) => (city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, ''),
  // heroStats가 매 마운트마다 getCurrentYear()를 호출하므로(건축년도 칩) 반드시 export 필요.
  getCurrentYear: () => 2026,
}))

vi.mock('~/utils/realEstateUrl', () => ({
  isRealEstateUrlType: vi.fn(() => true),
  toRealEstateUrl: vi.fn((p: any) =>
    `/real-estate/${p.type}/${p.city}/${p.district}/${p.buildingName}${p.buildingKey ? `/${p.buildingKey}` : ''}`
  ),
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
  mockSetFilters.mockClear()
  mockGoToPage.mockClear()
  mockRefresh.mockClear()
  mockRefreshOverview.mockClear()
  routerPush.mockClear()
  routerReplace.mockClear()
  vi.mocked((globalThis as any).useRoute).mockReturnValue({
    params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
    query: {},
  })
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
          PageHero: { template: '<section><component :is="titleTag || \'h1\'">{{ title }}</component></section>', props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'] },
          SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: { template: '<div />' },
          ComplexCard: { template: '<div />' },
          Pagination: { template: '<div />' },
          DataSourceSection: { template: '<div />' },
          RelatedGuides: { template: '<div />' },
          FacilityMap: { template: '<div />' },
          TransactionModeTab: { template: '<div />' },
          ExactDealFilters: {
            template: '<button data-testid="emit-wolse" @click="$emit(\'patch\', { mode: \'wolse\' })">월세</button>',
            props: ['filters', 'options', 'pending'],
            emits: ['patch'],
          },
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

  // ---------------- SEO 회귀 가드 (모바일 핵심정보 헤더 도입 후) ----------------
  // 모바일 전용 헤더(공용 MobileDetailHeader, md:hidden)가 정식 h1. 데스크톱 PageHero(hidden md:block)는
  // title-tag="div"(role=heading aria-level=1)로 강등 → raw HTML 의 literal <h1> 은 1개여야 한다.
  // 가드: h1 정확히 1개 + 건물명 (중복 h1 회귀 방지).
  it('건물명 H1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 건물명', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s.every(h => h.text() === '반포자이')).toBe(true)
  })

  it('Breadcrumb이 viewport에 무관하게 단일 렌더 (hidden md:block 제거됨)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const breadcrumbs = wrapper.findAll('[data-stub="breadcrumb"]')
    expect(breadcrumbs.length).toBe(1)
  })

  it('noindex 조건(buildingInfo=null)에서 canonical link가 출력되지 않아야 한다 (policy compliance)', async () => {
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
    // noindex 페이지에서는 canonical link가 없어야 한다 (noindex-canonical-policy.md)
    const hasCanonical = (resolved.link ?? []).some((l: any) => l.rel === 'canonical')
    expect(hasCanonical).toBe(false)

    // 복원
    vi.mocked(shouldNoindexRealEstateDetail).mockReturnValue(false)
  })

  it('indexable 조건에서는 canonical link가 출력되어야 한다', async () => {
    const { shouldNoindexRealEstateDetail } = await import('~/utils/realEstateNoindex')
    vi.mocked(shouldNoindexRealEstateDetail).mockReturnValue(false)

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
  })

  // ---------------- 섹션 재배치 회귀 가드 (spec §4.3 / 결정 1) ----------------
  // 데스크톱 사다리: 시세추이(md:order-4) → 전·월세비중(md:order-5) → Ad③(md:order-6)
  //                 → 위치(md:order-7) → Ad②(md:order-8) → 거래내역(md:order-9) → Ad④(md:order-10).
  // 모바일: 전·월세비중(order-5)이 시세추이(order-4) 직후로 승격.
  // SectionBlock stub의 루트 <section>에 class가 fall-through되므로 order 클래스로 직접 검사한다.
  // (heading prop은 stub 템플릿에 렌더되지 않으므로 텍스트 검색 불가)
  function sectionByOrderClass(wrapper: any, orderClass: string) {
    return wrapper.findAll('section').find((s: any) => s.classes().includes(orderClass))
  }

  it('시세 추이 섹션이 데스크톱 md:order-4 + 모바일 order-4 를 가진다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    // 시세 추이 SectionBlock은 order-4 md:order-4 (유일한 order-4 section)
    const sec = sectionByOrderClass(wrapper, 'order-4')
    expect(sec, '시세 추이 섹션(order-4)이 렌더되어야 한다').toBeTruthy()
    expect(sec.classes()).toContain('md:order-4')
  })

  it('거래 내역 섹션이 데스크톱 md:order-7 를 가진다 (승인된 차트→광고→표 순서)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    // 거래 내역 flat section은 order-6 md:order-7 (유일한 order-6 section)
    const sec = sectionByOrderClass(wrapper, 'order-6')
    expect(sec, '거래 내역 섹션(order-6)이 렌더되어야 한다').toBeTruthy()
    expect(sec.classes()).toContain('md:order-7')
  })

  it('재배치 후에도 h1 은 정확히 1개여야 한다 (단일 h1 불변식 재확인)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('h1').length).toBe(1)
  })

  it('상단 요약은 승인된 overview 필드와 flat section anchor를 사용한다', () => {
    const targetPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
    )
    const src = readFileSync(targetPath, 'utf-8')

    expect(src).toContain('latestSaleAmountLabel')
    expect(src).toContain('latestSaleDetailLine')
    expect(src).toContain('overviewBuildYearLabel')
    expect(src).toContain('overviewAreaRangeLabel')
    expect(src).toContain('overviewSaleCount6mLabel')
    expect(src).toContain('detailOverview.value?.latestSale')
    expect(src).toContain('<nav class="estate-section-nav"')
    expect(src).toContain('href="#transactions"')
    expect(src).not.toContain('heroStats')
    expect(src).not.toContain('MobileDetailHeader')
    expect(src).not.toContain('PageHero')
  })

  it('재배치·건축년도 병기 변경 후에도 h1 은 정확히 1개여야 한다 (단일 h1 불변식 재확인)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('h1').length).toBe(1)
  })

  it('정확 조건 필터·차트·표는 새 상세 스냅샷 계약에 연결된다', () => {
    const targetPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
    )
    const src = readFileSync(targetPath, 'utf-8')

    expect(src).toContain('<ExactDealFilters')
    expect(src).toContain('@patch="handleExactFilterPatch"')
    expect(src).toContain('<DealPriceChart')
    expect(src).toContain(':points="snapshot.points"')
    expect(src).toContain(':window="snapshot.window"')
    expect(src).toContain(':transactions="table.items"')
    expect(src).toContain('@page-change="goToExactPage"')
    expect(src).not.toContain('getTransactionStats')
    expect(src).not.toContain('searchTransactions')
    expect(src).not.toContain('getAreaGroups')
  })

  it('매매 상세에서 월세로 이동할 때 같은 buildingKey 경로와 mode=wolse query를 한 번에 push한다', async () => {
    const buildingKey = 'a'.repeat(64)
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: {
        realEstateType: 'apt-sale',
        city: 'seoul',
        district: 'gangnam',
        buildingName: '반포자이',
        buildingKey,
      },
      query: {},
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    await wrapper.get('[data-testid="emit-wolse"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      path: expect.stringContaining(`/real-estate/apt-rent/서울/강남구/반포자이/${buildingKey}`),
      query: { mode: 'wolse' },
    })
    expect(routerPush).toHaveBeenCalledTimes(1)
  })
})
