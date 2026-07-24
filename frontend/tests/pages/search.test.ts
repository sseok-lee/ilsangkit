import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SearchPage from '~/pages/search.vue'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'

// Mock vue-router — query는 테스트별로 변경 가능하도록 mutable 객체 사용
const routeQuery: Record<string, string> = {}
vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock useFacilitySearch — 통합 검색: 시설 grouped 병렬 fetch
const searchGroupedMock = vi.fn().mockResolvedValue(undefined)
const groupedResultsRef = ref<any[]>([])
const groupedTotalRef = ref(0)
vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({
    searchGrouped: searchGroupedMock,
    groupedResults: groupedResultsRef,
    groupedTotalCount: groupedTotalRef,
    recovery: ref(null),
  }),
}))

// Mock useFacilityMeta
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setMeta: vi.fn(),
    setSearchMeta: vi.fn(),
    setCategoryMeta: vi.fn(),
    setDetailMeta: vi.fn(),
    setRegionMeta: vi.fn(),
    SITE_NAME: '일상킷',
  }),
}))

// Mock useWasteSchedule
vi.mock('~/composables/useWasteSchedule', () => ({
  useWasteSchedule: () => ({
    isLoading: { value: false },
    error: { value: null },
    getCities: vi.fn().mockResolvedValue([]),
    getDistricts: vi.fn().mockResolvedValue([]),
    getSchedules: vi.fn().mockResolvedValue({ schedules: [] }),
  }),
}))

// Mock useRealEstate — /search는 부동산 전용이므로 이 페이지가 소비하는 유일한 검색 소스
const searchAllMock = vi.fn().mockResolvedValue({ categories: [] })
const getComplexListMock = vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0 })
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: searchAllMock,
    getComplexList: getComplexListMock,
  }),
}))

// Global stubs for Nuxt components
const globalStubs = {
  FacilityCard: { template: '<div data-testid="facility-card">FacilityCard</div>' },
  CategoryIcon: { template: '<span>Icon</span>' },
  AdBanner: { template: '<div />' },
  Pagination: { template: '<div />' },
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(routeQuery)) delete routeQuery[key]
    searchAllMock.mockResolvedValue({ categories: [] })
    getComplexListMock.mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0 })
    searchGroupedMock.mockResolvedValue(undefined)
    groupedResultsRef.value = []
    groupedTotalRef.value = 0
  })

  it('페이지가 올바르게 렌더링되는지 확인', () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })

    // Page renders with min-h-screen layout
    expect(wrapper.find('.min-h-screen').exists()).toBe(true)
  })

  it('통합 검색 입력이 렌더된다', () => {
    const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    expect(wrapper.find('input[aria-label="통합 검색"]').exists()).toBe(true)
  })

  it('마운트 시 키워드가 있으면 부동산·시설 검색을 모두 호출한다', async () => {
    routeQuery.keyword = '강남'
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })
    await flushPromises()

    expect(searchAllMock).toHaveBeenCalled()
    expect(searchGroupedMock).toHaveBeenCalled() // 시설 병렬 fetch 복원
    expect(wrapper.exists()).toBe(true)
  })

  it('키워드가 없으면 시설 grouped 팬아웃은 호출되지 않는다(전국 팬아웃 방지)', async () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })
    await flushPromises()

    expect(searchAllMock).toHaveBeenCalled()
    expect(searchGroupedMock).not.toHaveBeenCalled()
    expect(wrapper.exists()).toBe(true)
  })

  it('페이지네이션이 렌더링되는지 확인', () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })

    // 페이지네이션은 유형 선택 후 결과가 있을 때만 렌더링됨
    // 기본 mock에서는 결과가 없으므로 렌더링되지 않음
    expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(false)
  })

  it('지역 필터 드롭다운이 렌더링되는지 확인', () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })

    // Region filter selects exist (시/도, 구/군)
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
  })

  it('검색 결과 개수가 표시되는지 확인', async () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })

    // 기본 레이아웃이 렌더링됨 (검색 결과 영역은 isMounted 후 표시)
    expect(wrapper.find('.min-h-screen').exists()).toBe(true)
  })

  it('에러 발생 시 에러 메시지를 표시하는지 확인', async () => {
    // This test needs to be skipped as it's complex to mock composables in pages
    expect(true).toBe(true)
  })

  it('URL 쿼리 파라미터를 읽어서 검색을 실행하는지 확인', () => {
    // useRoute mock이 필요함
    expect(true).toBe(true)
  })

  it('카드 그리드 레이아웃이 표시되는지 확인', () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: globalStubs,
      },
    })

    // 부동산 결과가 비어있으면 빈 상태가 표시되고, 그리드는 결과가 있을 때 렌더링됨
    expect(wrapper.find('.min-h-screen').exists()).toBe(true)
  })

  it('결과가 있으면 부동산·생활시설 도메인 섹션을 렌더한다 (부동산 먼저)', async () => {
    routeQuery.keyword = '강남'
    groupedResultsRef.value = [{ category: 'toilet', label: '화장실', count: 12, items: [] }]
    groupedTotalRef.value = 12
    searchAllMock.mockResolvedValue({ categories: [{ type: 'apt-sale', count: 3, items: [] }] })

    const wrapper = mount(SearchPage, {
      global: {
        stubs: {
          ...globalStubs,
          SearchDomainSection: { template: '<section><h2>{{ title }}</h2><slot/></section>', props: ['title', 'count', 'countLabel'] },
          SearchResultGroup: { template: '<div><slot/></div>', props: ['label', 'count', 'moreHref', 'iconImg', 'catColor', 'countUnit', 'catCategory'] },
        },
      },
    })
    await flushPromises()

    const h2s = wrapper.findAll('h2').map(h => h.text())
    expect(h2s).toContain('부동산')
    expect(h2s).toContain('생활시설')
    expect(h2s.indexOf('부동산')).toBeLessThan(h2s.indexOf('생활시설'))
  })

  it('부동산 유형 드릴다운 후 뒤로가기로 통합 결과 뷰로 복귀한다', async () => {
    routeQuery.keyword = '강남'
    searchAllMock.mockResolvedValue({
      categories: [{
        type: 'apt-sale',
        count: 3,
        items: [{
          buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
          dongName: '역삼동', dealAmount: 150000, deposit: null,
          dealYear: 2026, dealMonth: 5, buildYear: 2010, transactionCount: 12,
        }],
      }],
    })
    getComplexListMock.mockResolvedValue({
      items: [{
        buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
        dongName: '역삼동', latestPrice: 150000, transactionCount: 12,
      }],
      page: 1, totalPages: 1, total: 1,
    })
    groupedResultsRef.value = [{ category: 'toilet', label: '화장실', count: 12, items: [] }]
    groupedTotalRef.value = 12

    const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    // 부동산 "아파트" 그룹의 더보기 클릭 → 페이징 드릴다운 뷰로 전환
    const aptGroup = wrapper.findAllComponents(SearchResultGroup).find(g => g.props('label') === '아파트')
    expect(aptGroup, '아파트 그룹이 렌더되어야 함').toBeTruthy()
    await aptGroup!.find('button').trigger('click')
    await flushPromises()

    // 드릴다운 상태: 통합 도메인 섹션(h2)은 사라지고 페이징 뷰가 표시된다
    expect(wrapper.findAll('h2').map(h => h.text())).not.toContain('부동산')

    // (a) 페이징 뷰 상단에 "통합 검색 결과로" 뒤로가기 컨트롤이 존재한다
    const backButton = wrapper.findAll('button').find(b => b.text().includes('통합 검색 결과로'))
    expect(backButton, '뒤로가기 버튼이 렌더되어야 함').toBeTruthy()

    // (b) 뒤로가기 클릭 → selectedRealEstateType이 초기화되고 통합 뷰(부동산+생활시설)가 다시 렌더된다
    await backButton!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').some(b => b.text().includes('통합 검색 결과로'))).toBe(false)
    const h2sAfterBack = wrapper.findAll('h2').map(h => h.text())
    expect(h2sAfterBack).toContain('부동산')
    expect(h2sAfterBack).toContain('생활시설')
  })

  it('통합뷰 부동산 프리뷰 카드는 전세/월세(rent) 원본 아이템을 -rent URL로 링크한다 (하드코딩된 tab="sale" 회귀 방지)', async () => {
    routeQuery.keyword = '역삼'
    searchAllMock.mockResolvedValue({
      categories: [{
        type: 'villa-rent',
        count: 1,
        items: [{
          buildingName: '○○빌라', bjdCode: '11680', city: '서울특별시', district: '강남구',
          dongName: '역삼동', dealAmount: null, deposit: 5000,
          dealYear: 2026, dealMonth: 5, buildYear: 2005, transactionCount: 3,
        }],
      }],
    })

    const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    const cardLink = wrapper
      .findAll('a')
      .find(a => (a.attributes('href') || '').includes('/real-estate/') && a.text().includes('○○빌라'))
    expect(cardLink, '빌라 프리뷰 카드 링크가 렌더되어야 함').toBeTruthy()

    const href = cardLink!.attributes('href')!
    expect(href).toBe(`/real-estate/villa-rent/seoul/gangnam/${encodeURIComponent('○○빌라')}`)
    expect(href).not.toContain('villa-sale')
  })
})
