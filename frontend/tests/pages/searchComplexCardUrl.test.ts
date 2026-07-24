import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SearchPage from '~/pages/search.vue'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'

// 회귀 방지: 검색 결과의 부동산 단지 카드는 4-세그먼트 정식 URL
// (/real-estate/{type}/{city}/{district}/{building})로 링크해야 한다.
// 구 2-세그먼트(/real-estate/apt/{building})는 클라이언트 내비게이션에서 404.

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { keyword: '래미안' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({
    loading: ref(false),
    facilities: ref([]),
    total: ref(0),
    currentPage: ref(1),
    totalPages: ref(0),
    error: ref(null),
    groupedResults: ref([]),
    groupedTotalCount: ref(0),
    recovery: ref(null),
    search: vi.fn(),
    searchGrouped: vi.fn().mockResolvedValue({}),
    resetPage: vi.fn(),
    setPage: vi.fn(),
    clearResults: vi.fn(),
  }),
}))

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setMeta: vi.fn(), setSearchMeta: vi.fn(), setCategoryMeta: vi.fn(),
    setDetailMeta: vi.fn(), setRegionMeta: vi.fn(), SITE_NAME: '일상킷',
  }),
}))

vi.mock('~/composables/useWasteSchedule', () => ({
  useWasteSchedule: () => ({
    isLoading: { value: false }, error: { value: null },
    getCities: vi.fn().mockResolvedValue([]),
    getDistricts: vi.fn().mockResolvedValue([]),
    getSchedules: vi.fn().mockResolvedValue({ schedules: [] }),
  }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setItemListSchema: vi.fn() }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({
    trackSearchResultsView: vi.fn(),
    trackSearchNoResults: vi.fn(),
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: vi.fn().mockResolvedValue({
      categories: [{
        type: 'apt-sale',
        count: 3,
        items: [{
          buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
          dongName: '역삼동', dealAmount: 150000, deposit: null,
          dealYear: 2026, dealMonth: 5, buildYear: 2010, transactionCount: 12,
        }],
      }],
    }),
    getComplexList: vi.fn().mockResolvedValue({
      items: [{
        buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
        dongName: '역삼동', latestPrice: 150000, transactionCount: 12,
      }],
      page: 1, totalPages: 1, total: 1,
    }),
  }),
}))

vi.mock('~/composables/useSearchSuggest', () => ({
  useSearchSuggest: () => ({
    items: ref([]), popular: ref([]), recent: ref([]),
    suggest: vi.fn(), loadPopular: vi.fn(), logSearch: vi.fn(),
    addRecent: vi.fn(), removeRecent: vi.fn(), clearRecent: vi.fn(),
    getSessionId: vi.fn().mockReturnValue('test-sid'),
  }),
}))

const globalStubs = {
  FacilityCard: { template: '<div />' },
  CategoryIcon: { template: '<span />' },
  AdBanner: { template: '<div />' },
  Pagination: { template: '<div />' },
  PageHero: { template: '<div><slot name="search" /></div>' },
  SectionBlock: { template: '<div><slot /><slot name="right" /></div>' },
  EmptyState: { template: '<div><slot /></div>' },
  SearchAutocomplete: { template: '<div />' },
  NuxtLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'\'"><slot /></a>' },
}

beforeEach(() => {
  localStorage.clear()
})

describe('검색 결과 부동산 단지 카드 URL', () => {
  it('아파트 타입 선택 시 카드가 4-세그먼트 정식 URL로 링크한다', async () => {
    const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    // 부동산 도메인 섹션의 "아파트" SearchResultGroup 더보기 클릭 → selectRealEstateType('apt') → getComplexList mock
    const aptGroup = wrapper.findAllComponents(SearchResultGroup).find((g) => g.props('label') === '아파트')
    expect(aptGroup, '아파트 그룹이 렌더되어야 함').toBeTruthy()
    const aptMoreButton = aptGroup!.find('button')
    expect(aptMoreButton.exists(), '아파트 더보기 버튼이 렌더되어야 함').toBe(true)
    await aptMoreButton.trigger('click')
    await flushPromises()

    const cardLink = wrapper
      .findAll('a')
      .find((a) => (a.attributes('href') || '').includes('/real-estate/') && a.text().includes('래미안강남'))
    expect(cardLink, '단지 카드 링크가 렌더되어야 함').toBeTruthy()

    const href = cardLink!.attributes('href')!
    // 정식 4-세그먼트: /real-estate/apt-sale/seoul/gangnam/래미안강남
    expect(href).toBe(`/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`)
    // 구 2-세그먼트 금지
    expect(href).not.toMatch(/\/real-estate\/apt\//)
  })
})
