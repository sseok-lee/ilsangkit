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

const navigateToMock = vi.fn()
;(globalThis as any).navigateTo = navigateToMock

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
  query: {},
  path: '/real-estate/apt-sale/seoul/gangnam/%EB%B0%98%ED%8F%AC%EC%9E%90%EC%9D%B4',
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
    p.canonicalPath
      ? p.canonicalPath
      : `/real-estate/${p.type}/${p.city}/${p.district}/${p.buildingName}`
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
  navigateToMock.mockClear()
  vi.mocked((globalThis as any).useAsyncData).mockClear()
  ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { mode: 'keyed', canonicalPath: null } })
  vi.mocked((globalThis as any).useAsyncData).mockImplementation((key: string, handler?: () => unknown) => {
    if (key.startsWith('re-public-url-resolution-')) {
      return Promise.resolve(handler ? handler() : null).then(data => ({
        data: ref(data),
        status: ref('success'),
        error: ref(null),
        refresh: vi.fn(),
        pending: ref(false),
      }))
    }
    return {
      data: ref(null),
      status: ref('idle'),
      error: ref(null),
      refresh: vi.fn(),
      pending: ref(false),
    } as any
  })
  vi.mocked((globalThis as any).useRoute).mockReturnValue({
    params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
    query: {},
    path: '/real-estate/apt-sale/seoul/gangnam/%EB%B0%98%ED%8F%AC%EC%9E%90%EC%9D%B4',
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
  it('주소 suffix 라우트는 내부 buildingKey처럼 검증하지 않고 resolver로 넘긴다', async () => {
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: {
        realEstateType: 'apt-sale',
        city: 'seoul',
        district: 'gangnam',
        buildingName: '반포자이',
        addressSuffix: '반포동-20-43',
      },
      query: {},
      path: '/real-estate/apt-sale/seoul/gangnam/%EB%B0%98%ED%8F%AC%EC%9E%90%EC%9D%B4/%EB%B0%98%ED%8F%AC%EB%8F%99-20-43',
    })
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: {
        mode: 'preserved',
        type: 'apt-sale',
        buildingKey: 'b'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '반포자이',
        canonicalPath: '/real-estate/apt-sale/seoul/gangnam/%EB%B0%98%ED%8F%AC%EC%9E%90%EC%9D%B4/%EB%B0%98%ED%8F%AC%EB%8F%99-20-43',
        redirect: false,
      },
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await expect(mountSuspended(m.default)).resolves.toBeTruthy()
    expect((globalThis as any).$fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/real-estate/resolve-url'),
      expect.objectContaining({
        query: {
          path: '/real-estate/apt-sale/seoul/gangnam/%EB%B0%98%ED%8F%AC%EC%9E%90%EC%9D%B4/%EB%B0%98%ED%8F%AC%EB%8F%99-20-43',
        },
      }),
    )
  })

  it('public URL resolver는 hydration 재호출을 막기 위해 useAsyncData payload로 감싼다', async () => {
    const useAsyncDataSpy = vi.mocked((globalThis as any).useAsyncData)

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    await mountSuspended(m.default)

    expect(useAsyncDataSpy.mock.calls.some(([key]) =>
      typeof key === 'string' && key.startsWith('re-public-url-resolution-'),
    )).toBe(true)
  })

  it('해시 suffix 공개 URL은 301 alias로 두지 않고 404 가드로 둔다', () => {
    const targetPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
    )
    const src = readFileSync(targetPath, 'utf-8')

    expect(src).toContain('addressSuffix')
    expect(src).toContain('hasHashAddressSuffix')
    expect(src).toContain("throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })")
  })



  it('동일 건물명 readable suffix 상세들은 resolver key가 달라져도 SSR detail cache key가 충돌하지 않는다', async () => {
    const firstPath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}/${encodeURIComponent('반포동-20-43')}`
    const secondPath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}/${encodeURIComponent('반포동-20-44')}`
    const firstKey = 'a'.repeat(64)
    const secondKey = 'b'.repeat(64)
    const useAsyncDataSpy = vi.mocked((globalThis as any).useAsyncData)
    ;(globalThis as any).$fetch = vi.fn().mockImplementation((_url: string, options?: { query?: { path?: string } }) => {
      if (options?.query?.path === firstPath) {
        return Promise.resolve({ success: true, data: { mode: 'preserved', type: 'apt-sale', buildingKey: firstKey, bjdCode: '1168010100', buildingName: '반포자이', canonicalPath: firstPath, redirect: false } })
      }
      if (options?.query?.path === secondPath) {
        return Promise.resolve({ success: true, data: { mode: 'preserved', type: 'apt-sale', buildingKey: secondKey, bjdCode: '1168010100', buildingName: '반포자이', canonicalPath: secondPath, redirect: false } })
      }
      return Promise.resolve({ success: true, data: { mode: 'keyed', canonicalPath: null } })
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')

    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이', addressSuffix: '반포동-20-43' },
      query: {},
      path: firstPath,
    })
    await mountSuspended(m.default)
    const firstDetailKey = useAsyncDataSpy.mock.calls.map(([key]) => key).find((key): key is string => typeof key === 'string' && key.startsWith('re-detail-new-'))

    useAsyncDataSpy.mockClear()
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이', addressSuffix: '반포동-20-44' },
      query: {},
      path: secondPath,
    })
    await mountSuspended(m.default)
    const secondDetailKey = useAsyncDataSpy.mock.calls.map(([key]) => key).find((key): key is string => typeof key === 'string' && key.startsWith('re-detail-new-'))

    expect(firstDetailKey).toBeTruthy()
    expect(secondDetailKey).toBeTruthy()
    expect(firstDetailKey).not.toBe(secondDetailKey)
    expect(firstDetailKey).toContain(encodeURIComponent('반포동-20-43'))
    expect(secondDetailKey).toContain(encodeURIComponent('반포동-20-44'))
  })

  it('legacy grouped base 상세도 같은 건물명 readable suffix와 다른 SSR detail cache key를 가진다', async () => {
    const groupedBasePath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}`
    const readableSuffixPath = `${groupedBasePath}/${encodeURIComponent('반포동-20-43')}`
    const useAsyncDataSpy = vi.mocked((globalThis as any).useAsyncData)
    ;(globalThis as any).$fetch = vi.fn().mockImplementation((_url: string, options?: { query?: { path?: string } }) => {
      if (options?.query?.path === groupedBasePath) {
        return Promise.resolve({ success: true, data: { mode: 'preserved', type: 'apt-sale', bjdCode: '1168010100', buildingName: '반포자이', canonicalPath: groupedBasePath, redirect: false, legacyGrouped: true } })
      }
      if (options?.query?.path === readableSuffixPath) {
        return Promise.resolve({ success: true, data: { mode: 'preserved', type: 'apt-sale', buildingKey: 'a'.repeat(64), bjdCode: '1168010100', buildingName: '반포자이', canonicalPath: readableSuffixPath, redirect: false } })
      }
      return Promise.resolve({ success: true, data: { mode: 'keyed', canonicalPath: null } })
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')

    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
      query: {},
      path: groupedBasePath,
    })
    await mountSuspended(m.default)
    const groupedDetailKey = useAsyncDataSpy.mock.calls.map(([key]) => key).find((key): key is string => typeof key === 'string' && key.startsWith('re-detail-new-'))

    useAsyncDataSpy.mockClear()
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'gangnam', buildingName: '반포자이', addressSuffix: '반포동-20-43' },
      query: {},
      path: readableSuffixPath,
    })
    await mountSuspended(m.default)
    const suffixDetailKey = useAsyncDataSpy.mock.calls.map(([key]) => key).find((key): key is string => typeof key === 'string' && key.startsWith('re-detail-new-'))

    expect(groupedDetailKey).toBeTruthy()
    expect(suffixDetailKey).toBeTruthy()
    expect(groupedDetailKey).not.toBe(suffixDetailKey)
    expect(groupedDetailKey).toContain(groupedBasePath)
    expect(suffixDetailKey).toContain(encodeURIComponent('반포동-20-43'))
  })

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

  // ---------------- SEO 회귀 가드 ----------------
  // 머리는 PageHead 하나(기본 h1)가 모바일·데스크톱을 함께 맡는다 → raw HTML 의 literal <h1> 은 1개여야 한다.
  // 가드: h1 정확히 1개 + 건물명 (중복 h1 회귀 방지).
  it('건물명 H1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 건물명', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s.every(h => h.text() === '반포자이')).toBe(true)
    const summary = wrapper.get('[aria-label="실거래 요약"]')
    expect(summary.element.tagName).toBe('DL')
    expect(summary.classes()).toContain('summary-row--lead')
  })

  it('Breadcrumb이 viewport에 무관하게 단일 렌더 (hidden md:block 제거됨)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const breadcrumbs = wrapper.findAll('[data-stub="breadcrumb"]')
    expect(breadcrumbs.length).toBe(1)
  })



  it('noindex 전환은 setup 밖에서 useState 를 다시 호출하지 않고 캡처한 광고 suppression ref만 갱신한다', async () => {
    const { shouldNoindexRealEstateDetail } = await import('~/utils/realEstateNoindex')
    const noindexFlag = ref(false)
    vi.mocked(shouldNoindexRealEstateDetail).mockImplementation(() => noindexFlag.value)

    const originalUseState = (globalThis as any).useState
    const adsSuppressed = ref(false)
    let setupContextOpen = true
    const useStateSpy = vi.fn((key: string, init?: () => unknown) => {
      if (key === 'ads:suppressed') {
        if (!setupContextOpen) throw new Error('useState called after setup context')
        return adsSuppressed
      }
      return originalUseState(key, init)
    })
    ;(globalThis as any).useState = useStateSpy

    try {
      const placeholderPath = '/real-estate/offitel-sale/seoul/gangnam/(1012)'
      vi.mocked((globalThis as any).useRoute).mockReturnValue({
        params: { realEstateType: 'offitel-sale', city: 'seoul', district: 'gangnam', buildingName: '(1012)' },
        query: {},
        path: placeholderPath,
      })
      ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { mode: 'keyed', canonicalPath: null } })

      const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
      await mountSuspended(m.default)
      setupContextOpen = false
      noindexFlag.value = true
      await flushPromises()

      expect(adsSuppressed.value).toBe(true)
      expect(useStateSpy.mock.calls.filter(([key]) => key === 'ads:suppressed')).toHaveLength(1)
    } finally {
      setupContextOpen = true
      ;(globalThis as any).useState = originalUseState
      vi.mocked(shouldNoindexRealEstateDetail).mockReturnValue(false)
    }
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
    expect(src).toContain('<PageHead')
    expect(src).toContain('estateSummaryItems')
    expect(src).not.toContain('estate-detail-head')
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

  it('매매 상세에서 월세로 이동할 때 같은 buildingKey의 임대 canonicalPath와 mode=wolse query를 한 번에 push한다', async () => {
    const buildingKey = 'a'.repeat(64)
    const rentCanonicalPath = `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('반포자이')}`
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: {
        realEstateType: 'apt-sale',
        city: 'seoul',
        district: 'gangnam',
        buildingName: '반포자이',
      },
      query: {},
      path: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}`,
    })
    ;(globalThis as any).$fetch = vi.fn().mockImplementation((url: string, options?: { query?: { path?: string } }) => {
      if (url.includes('/resolve-url')) {
        return Promise.resolve({
          success: true,
          data: {
            mode: 'preserved',
            type: 'apt-sale',
            buildingKey,
            bjdCode: '1168010100',
            buildingName: '반포자이',
            canonicalPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}`,
            redirect: false,
          },
        })
      }
      if (url.includes('/canonical-url')) {
        return Promise.resolve({ success: true, data: { mode: 'preserved', canonicalPath: rentCanonicalPath } })
      }
      return Promise.resolve({ success: true, data: { mode: 'keyed', canonicalPath: null } })
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    await wrapper.get('[data-testid="emit-wolse"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      path: rentCanonicalPath,
      query: { mode: 'wolse' },
    })
    expect(routerPush).toHaveBeenCalledTimes(1)
  })

  it('legacy grouped 상세에서 월세로 이동할 때 sibling base resolver를 사용하고 buildingKey를 만들지 않는다', async () => {
    const saleCanonicalPath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('반포자이')}`
    const rentResolvedPath = '/real-estate/apt-rent/서울/강남구/반포자이'
    vi.mocked((globalThis as any).useRoute).mockReturnValue({
      params: {
        realEstateType: 'apt-sale',
        city: 'seoul',
        district: 'gangnam',
        buildingName: '반포자이',
      },
      query: {},
      path: saleCanonicalPath,
    })
    ;(globalThis as any).$fetch = vi.fn().mockImplementation((_url: string, options?: { query?: { path?: string } }) => {
      if (options?.query?.path === saleCanonicalPath) {
        return Promise.resolve({
          success: true,
          data: {
            mode: 'preserved',
            type: 'apt-sale',
            bjdCode: '1168010100',
            buildingName: '반포자이',
            canonicalPath: saleCanonicalPath,
            redirect: false,
            legacyGrouped: true,
          },
        })
      }
      if (options?.query?.path === rentResolvedPath) {
        return Promise.resolve({
          success: true,
          data: {
            mode: 'preserved',
            type: 'apt-rent',
            bjdCode: '1168010100',
            buildingName: '반포자이',
            canonicalPath: rentResolvedPath,
            redirect: false,
            legacyGrouped: true,
          },
        })
      }
      return Promise.resolve({ success: true, data: { mode: 'keyed', canonicalPath: null } })
    })

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    mockSetFilters.mockClear()
    await wrapper.get('[data-testid="emit-wolse"]').trigger('click')
    await flushPromises()

    expect(mockSetFilters).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith({
      path: rentResolvedPath,
      query: { mode: 'wolse' },
    })
    expect((globalThis as any).$fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/canonical-url'),
      expect.anything(),
    )
    expect(routerPush.mock.calls[0][0].path).not.toMatch(/[a-f0-9]{64}$/)
  })
})
