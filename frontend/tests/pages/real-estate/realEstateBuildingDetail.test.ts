import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, type Component } from 'vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { DetailOverview } from '~/types/housingRedesign'

const { default: AddressLine } = await vi.importActual<{ default: Component }>('~/components/common/AddressLine.vue')

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
let mockDetailOverview: DetailOverview | null = null

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
      overview: ref(mockDetailOverview),
      snapshot: ref({
        filters: {
          bjdCode: '1168010100',
          buildingName: '반포자이',
          mode: 'sale',
          months: 6,
          area: '84.90',
          deposit: null,
        },
        options: { areas: [{ key: '85', label: '84', count: 1 }], deposits: [] },
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
  REAL_ESTATE_REGIONS: { '서울': ['강남구', '강북구'] },
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
  mockDetailOverview = null
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
        components: { AddressLine },
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: {
            props: ['variant', 'only'],
            template: '<div data-ad-stub :data-variant="variant" :data-only="only" />',
          },
          Pagination: { template: '<div />' },
          DataSourceSection: { template: '<div />' },
          RelatedGuides: { template: '<div />' },
          FacilityMap: { template: '<div />' },
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
  // Policy stub: verifies page placement/props, not the actual mobile ad render count.
  describe.each([
    {
      label: '단일 주소',
      addresses: [{ dongName: '반포동', jibun: '20-43', roadName: '반포대로 58' }],
      expectedAddress: '서울 강남구 반포대로 58',
      legacyGrouped: false,
    },
    {
      label: '모바일 두 줄 길이의 긴 주소',
      addresses: [{ dongName: '반포동', jibun: '20-43', roadName: '반포대로 58길 123 일상아파트 제101동 공동주택 주출입구' }],
      expectedAddress: '서울 강남구 반포대로 58길 123 일상아파트 제101동 공동주택 주출입구',
      legacyGrouped: false,
    },
    {
      label: 'legacyGrouped 주소 후보',
      addresses: [
        { dongName: '반포동', jibun: '20-43', roadName: '반포대로 58' },
        { dongName: '반포동', jibun: '20-44', roadName: '반포대로 60' },
      ],
      expectedAddress: '주소 후보 2건',
      legacyGrouped: true,
    },
  ])('$label의 헤더 광고', ({ addresses, expectedAddress, legacyGrouped }) => {
    it.each(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'])(
      '%s에서 주소 뒤·요약 앞에 모바일 전용 슬롯을 한 번 배치한다',
      async (realEstateType) => {
        const canonicalPath = `/real-estate/${realEstateType}/seoul/gangnam/${encodeURIComponent('반포자이')}`
        vi.stubGlobal('useRoute', vi.fn().mockReturnValue({
          params: { realEstateType, city: 'seoul', district: 'gangnam', buildingName: '반포자이' },
          query: {},
          path: canonicalPath,
        }))
        if (legacyGrouped) {
          vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
            success: true,
            data: {
              mode: 'preserved',
              type: realEstateType,
              bjdCode: '1168010100',
              buildingName: '반포자이',
              canonicalPath,
              redirect: false,
              legacyGrouped: true,
            },
          }))
        }
        mockDetailOverview = {
          identity: { bjdCode: '1168010100', buildingName: '반포자이', legacyGrouped },
          latestSale: null,
          buildYear: 2009,
          minArea: '84.90',
          maxArea: '84.90',
          saleCount6m: 0,
          window6m: { from: '2026-04-15', to: '2026-10-15' },
          addresses,
          location: null,
          locationAmbiguous: legacyGrouped,
          basisMode: realEstateType.endsWith('-rent') ? 'jeonse' : 'sale',
          defaultAreaGroup: '85',
          areaGroups: [{ key: '85', label: '84', pyeong: 26, saleCount36m: 3, jeonseCount36m: 2 }],
          saleBasis: {},
          jeonseBasis: {},
          generatedAt: '2026-10-15T00:00:00.000Z',
        }

        const m = await vi.importActual<{ default: Component }>('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
        const wrapper = await mountSuspended(m.default)
        try {
          const slots = wrapper.findAll('[data-variant="mobile-banner-320x100"]')
          expect(slots).toHaveLength(1)
          const slot = slots[0]
          const head = wrapper.get('.page-head')
          const summary = head.get('.estate-price-hero')
          const address = head.get(legacyGrouped ? 'a[href="#reported-addresses"]' : 'p.mt-3')
          expect(address.text()).toContain(expectedAddress)
          expect(head.element.contains(slot.element)).toBe(true)
          expect(slot.attributes('data-only')).toBe('mobile')
          expect(slot.attributes('data-testid')).toBe('building-header-ad')
          expect(slot.classes()).toContain('estate-header-mobile-ad')
          expect(slot.classes()).not.toContain('estate-ad-slot')
          expect(address.element.compareDocumentPosition(slot.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
          expect(slot.element.compareDocumentPosition(summary.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
          expect(summary.classes()).toContain('mt-[22px]')
          expect(summary.classes()).toContain('md:mt-7')
          expect(wrapper.findAll('[data-ad-stub]:not([data-variant])')).toHaveLength(4)
        } finally {
          wrapper.unmount()
        }
      },
    )
  })

  it('같은 도로명으로 합쳐진 legacy grouped 상세는 주소 1건과 지도·주변 생활시설을 보여준다', async () => {
    const canonicalPath = `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('신도림역동문디이스트')}`
    vi.stubGlobal('useRoute', vi.fn().mockReturnValue({
      params: { realEstateType: 'apt-rent', city: 'seoul', district: 'gangnam', buildingName: '신도림역동문디이스트' },
      query: {},
      path: canonicalPath,
    }))
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      success: true,
      data: {
        mode: 'preserved',
        type: 'apt-rent',
        bjdCode: '1168010100',
        buildingName: '신도림역동문디이스트',
        canonicalPath,
        redirect: false,
        legacyGrouped: true,
      },
    }))
    // 백엔드가 구로동 33·1293(같은 공원로6가길 58)을 최근 지번 하나로 합쳐 내려준 결과
    mockDetailOverview = {
      identity: { bjdCode: '1168010100', buildingName: '신도림역동문디이스트', legacyGrouped: true },
      latestSale: null,
      buildYear: 2026,
      minArea: '84.90',
      maxArea: '84.90',
      saleCount6m: 0,
      window6m: { from: '2026-04-27', to: '2026-10-27' },
      addresses: [{ dongName: '구로동', jibun: '1293', roadName: '공원로6가길 58' }],
      location: { lat: 37.5041109, lng: 126.8897398 },
      locationAmbiguous: false,
      basisMode: 'jeonse',
      defaultAreaGroup: '85',
      areaGroups: [{ key: '85', label: '84', pyeong: 26, saleCount36m: 0, jeonseCount36m: 2 }],
      saleBasis: {},
      jeonseBasis: {},
      generatedAt: '2026-10-27T00:00:00.000Z',
    }

    const m = await vi.importActual<{ default: Component }>('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    try {
      const head = wrapper.get('.page-head')
      expect(head.find('a[href="#reported-addresses"]').exists()).toBe(false)
      expect(head.get('p.mt-3').text()).toContain('서울 강남구 공원로6가길 58')
      expect(wrapper.find('#reported-addresses').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('주소 후보')
      // 지도 크게 보기·길찾기는 좌표가 확정됐을 때만 렌더된다
      expect(wrapper.get('#location').text()).toContain('길찾기')
      expect(wrapper.get('#location').text()).not.toContain('대표 위치를 표시하지 않습니다')
      // 주변 생활시설은 빈 상태 대신 반경 검색 컴포넌트로 간다
      expect(wrapper.text()).not.toContain('주소 후보별 지도 검색으로 확인하세요')
      expect(wrapper.text()).not.toContain('반경 검색을 할 수 없습니다')
    } finally {
      wrapper.unmount()
    }
  })

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
    // overview 가 아직 없고 오류도 없으면 같은 높이의 스켈레톤으로 자리를 잡는다.
    expect(wrapper.find('[data-testid="estate-price-hero-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('.summary-row').exists()).toBe(false)
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

  it('K-apt 단지와 연결되면 머리 줄·바로가기·단지 정보 섹션(order-8 md:order-9)을 SSR 로 낸다', async () => {
    mockDetailOverview = {
      identity: { bjdCode: '11680', buildingName: '개포경남' },
      latestSale: null,
      buildYear: 1983,
      minArea: null,
      maxArea: null,
      saleCount6m: 0,
      window6m: { from: '2026-04-23', to: '2026-10-23' },
      addresses: [],
      location: null,
      locationAmbiguous: false,
      basisMode: 'sale',
      defaultAreaGroup: null,
      areaGroups: [],
      saleBasis: {},
      jeonseBasis: {},
      complex: {
        matchType: 'address', kaptCode: 'A13580602', name: '개포경남아파트',
        householdCount: 678, dongCount: 9, topFloor: 15, basementFloors: 0, useApprovalDate: '1984-03-08',
        totalParking: 747, groundParking: 747, undergroundParking: 0, heatingType: '지역난방', corridorType: '계단식',
        builder: '경남건설', developer: '경남건설', managementType: '위탁관리', saleType: '분양',
        elevatorCount: 26, cctvCount: 102, evChargerCount: 9, areas: [{ exclusiveArea: 96.98, householdCount: 166 }],
        sourceDate: '2026-10-26',
      },
      generatedAt: '2026-10-23T00:00:00.000Z',
    } as DetailOverview
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('.estate-facts').text()).toContain('678세대 · 9개 동 · 최고 15층 · 1984년 사용승인')
    expect(wrapper.find('.estate-facts a[href="#complex-info"]').exists()).toBe(true)
    const navLinks = wrapper.findAll('.estate-section-nav a').map((a) => a.attributes('href'))
    expect(navLinks.indexOf('#complex-info')).toBe(navLinks.indexOf('#transactions') + 1)
    const sec = wrapper.find('#complex-info')
    expect(sec.exists()).toBe(true)
    expect(sec.classes()).toEqual(expect.arrayContaining(['order-8', 'md:order-9']))
    expect(sec.text()).toContain('출처: 국토교통부 K-apt 공동주택관리정보시스템')
  })

  it('단지와 연결되지 않으면 단지 정보 섹션·바로가기가 없다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('#complex-info').exists()).toBe(false)
    expect(wrapper.find('.estate-section-nav a[href="#complex-info"]').exists()).toBe(false)
  })

  it('재배치 후에도 h1 은 정확히 1개여야 한다 (단일 h1 불변식 재확인)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('h1').length).toBe(1)
  })

  it('상단 가격 영역은 기본 면적 그룹 최근 거래를 보여주고 칩 선택 시 면적 필터를 바꾼다', async () => {
    mockDetailOverview = {
      identity: { bjdCode: '1168010100', buildingName: '반포자이' },
      latestSale: { id: 1, amount: 52000, year: 2026, month: 10, day: 14, area: '84.90', floor: 12 },
      buildYear: 2009,
      minArea: '59.90',
      maxArea: '84.90',
      saleCount6m: 12,
      window6m: { from: '2026-04-23', to: '2026-10-23' },
      addresses: [{ dongName: '반포동', jibun: '20-43', roadName: '반포대로 58' }],
      location: null,
      locationAmbiguous: false,
      basisMode: 'sale',
      defaultAreaGroup: '85',
      areaGroups: [
        { key: '60', label: '59', pyeong: 18, saleCount36m: 40, jeonseCount36m: 0 },
        { key: '85', label: '84', pyeong: 26, saleCount36m: 90, jeonseCount36m: 0 },
      ],
      saleBasis: {
        '85': {
          representative: 94000,
          sampleCount: 5,
          latestAny: { id: 2, date: '2026-10-19', amount: 91000, floor: 20, direct: false },
          max12m: 103000,
          yearAgo: null,
          changeRate: null,
        },
      },
      jeonseBasis: {},
      generatedAt: '2026-10-23T00:00:00.000Z',
    } as DetailOverview

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const hero = wrapper.get('.page-head').get('.estate-price-hero')
    expect(hero.text()).toContain('최근 매매')
    expect(hero.text()).toContain('9억 1,000만')
    expect(hero.text()).toContain('최근 1년 5건 중간 9억 4,000만원')
    expect(hero.text()).not.toContain('시세')
    // 면적 무관 단건 최근 매매(overview.latestSale 5.2억)가 머리 숫자로 나오지 않는다.
    expect(hero.text()).not.toContain('5억 2,000만')

    // JSON-LD 가격 = 기본 그룹 최근 거래(만원) × 10000. 이름에 average 를 쓰지 않는다.
    const listingInput = mockSetRealEstateListingSchema.mock.calls.at(-1)?.[0]
    const listing = typeof listingInput === 'function' ? listingInput() : listingInput
    expect(listing.latestDealPrice).toBe(91000 * 10_000)
    expect(listing).not.toHaveProperty('recentAvg')
    expect(wrapper.text()).toContain('2009년 준공')
    expect(wrapper.text()).toContain('6개월 매매 12건')

    const chip = hero.findAll('.estate-price-hero__chips button[aria-pressed]').find(b => b.text().includes('59㎡'))!
    await chip.trigger('click')
    await flushPromises()
    expect(mockSetFilters).toHaveBeenCalledWith({ area: '60' })
  })

  it.each([
    ['jeonse', 7],
    ['sale', 0],
  ] as const)('머리 보조 줄은 basisMode=%s·6개월 매매 %s건이면 매매 수를 뺀다', async (basisMode, saleCount6m) => {
    mockDetailOverview = {
      identity: { bjdCode: '1168010100', buildingName: '반포자이' },
      latestSale: null,
      buildYear: 2009,
      minArea: '84.90',
      maxArea: '84.90',
      saleCount6m,
      window6m: { from: '2026-04-23', to: '2026-10-23' },
      addresses: [{ dongName: '반포동', jibun: '20-43', roadName: '반포대로 58' }],
      location: null,
      locationAmbiguous: false,
      basisMode,
      defaultAreaGroup: '85',
      areaGroups: [{ key: '85', label: '84', pyeong: 26, saleCount36m: 3, jeonseCount36m: 3 }],
      saleBasis: {},
      jeonseBasis: {},
      generatedAt: '2026-10-23T00:00:00.000Z',
    } as DetailOverview

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.text()).toContain('2009년 준공')
    expect(wrapper.text()).not.toContain('6개월 매매')
  })

  it('상단 요약은 승인된 overview 필드와 flat section anchor를 사용한다', () => {
    const targetPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
    )
    const src = readFileSync(targetPath, 'utf-8')

    expect(src).toContain('<EstatePriceHero')
    expect(src).toContain('@select-area="handleHeroAreaSelect"')
    expect(src).toContain('handleExactFilterPatch({ area: key })')
    expect(src).not.toContain('latestSaleAmountLabel')
    expect(src).not.toContain('latestSaleDetailLine')
    expect(src).not.toContain('<SummaryRow')
    expect(src).toContain('overviewBuildYearLabel')
    expect(src).toContain('overviewAreaRangeLabel')
    expect(src).toContain('overviewSaleCount6mLabel')
    expect(src).toContain('<nav class="estate-section-nav"')
    expect(src).toContain('href="#transactions"')
    expect(src).not.toContain('heroStats')
    expect(src).not.toContain('MobileDetailHeader')
    expect(src).not.toContain('PageHero')
    expect(src).toContain('<PageHead')
    expect(src).not.toContain('estateSummaryItems')
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
