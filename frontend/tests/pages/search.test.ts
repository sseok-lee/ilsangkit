import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import SearchPage from '~/pages/search.vue'
import FacilitySearchRow from '~/components/search/FacilitySearchRow.vue'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'
import type { Facility, GroupedSearchResponse } from '~/types/facility'

enableAutoUnmount(afterEach)

const routeQuery = reactive<Record<string, string>>({})
const api = vi.hoisted(() => ({
  searchAll: vi.fn(),
  searchProperty: vi.fn(),
  requestGrouped: vi.fn(),
  logSearch: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ query: routeQuery }) }))
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: api.searchAll,
    searchPropertyComplexesByKeyword: api.searchProperty,
  }),
}))
vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({ requestGrouped: api.requestGrouped }),
}))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setSearchMeta: vi.fn() }),
}))
vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackSearchResultsView: vi.fn(), trackSearchNoResults: vi.fn() }),
}))
vi.mock('~/composables/useSearchSuggest', () => ({
  useSearchSuggest: () => ({ logSearch: api.logSearch, items: ref([]), popular: ref([]), recent: ref([]) }),
}))

function facility(id: string, category: Facility['category']): Facility {
  return {
    id,
    name: `${category}-${id}`,
    category,
    address: `서울 ${id}`,
    roadAddress: null,
    lat: 37.5,
    lng: 127,
    city: '서울',
    district: '강남구',
    extras: {},
  }
}

const buildings = {
  categories: [{
    type: 'apt-sale',
    count: 4,
    items: Array.from({ length: 4 }, (_, index) => ({
      type: 'apt-sale',
      buildingName: `검증아파트${index}`,
      bjdCode: `1168${index}`,
      city: '서울',
      district: '강남구',
      dongName: '삼성동',
      latestPrice: 100000,
      transactionCount: 1,
      lat: null,
      lng: null,
      lastDealYear: 2026,
      lastDealMonth: 9,
      buildYear: 2020,
      latestDeals: {
        sale: { kind: 'sale', amount: 100000, deposit: null, monthlyRent: null, exclusiveArea: 84, floor: 10, dealYear: 2026, dealMonth: 9, dealDay: 1 },
        jeonse: null,
        wolse: null,
      },
    })),
  }],
  buildingCounts: { apt: 4, villa: 0, offitel: 0 },
}

const grouped: GroupedSearchResponse = {
  totalCount: 9,
  categories: [
    { category: 'trash', label: '쓰레기', count: 2, unit: '지역', items: [facility('trash-1', 'trash')] },
    { category: 'toilet', label: '화장실', count: 2, items: [facility('toilet-1', 'toilet')] },
    { category: 'hospital', label: '병원', count: 5, items: Array.from({ length: 4 }, (_, index) => facility(`hospital-${index}`, 'hospital')) },
  ],
}

const stubs = {
  AdBanner: { template: '<div data-testid="ad" />' },
  EmptyState: { props: ['title', 'description'], template: '<div data-testid="empty">{{ title }}</div>' },
  CategoryIcon: { template: '<span />' },
}

describe('SearchPage Task 7', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(routeQuery)) delete routeQuery[key]
    routeQuery.q = '강남'
    api.searchAll.mockResolvedValue(buildings)
    api.requestGrouped.mockResolvedValue(grouped)
    api.searchProperty.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 })
    ;(globalThis as typeof globalThis & { navigateTo: ReturnType<typeof vi.fn> }).navigateTo = vi.fn()
  })

  it('Task 6 overview를 q로 한 번 호출하고 시설 preview limit 3을 사용한다', async () => {
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(api.searchAll).toHaveBeenCalledOnce()
    expect(api.searchAll).toHaveBeenCalledWith('강남')
    expect(api.requestGrouped).toHaveBeenCalledWith({ keyword: '강남', limit: 3 })
    expect(wrapper.get('h1').text()).toBe('어떤 곳을 찾으세요?')
  })

  it('true count를 표시하고 그룹 preview는 최대 3개이며 동률은 FACILITY_CATEGORIES 순서다', async () => {
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('생활시설 9곳')
    expect(wrapper.text()).toContain('2지역')
    const facilityGroups = wrapper.findAllComponents(SearchResultGroup)
      .filter(group => ['병원', '화장실', '쓰레기'].includes(group.props('label')))
    expect(facilityGroups.map(group => group.props('label'))).toEqual(['병원', '화장실', '쓰레기'])
    expect(facilityGroups[0].props('count')).toBe(5)
    expect(facilityGroups[0].findAllComponents(FacilitySearchRow)).toHaveLength(3)
    expect(facilityGroups[0].props('moreLabel')).toBe('전체 보기')
    expect(wrapper.text()).toContain('‘강남’ 검색 결과에서')
    expect(wrapper.text()).toContain('전체 결과 기준')
    expect(wrapper.text()).toContain('카테고리별 최대 3개 미리보기')
    expect(wrapper.text()).not.toContain('표본')
  })

  it('실패 domain을 전체 탭 count·광고·빈 결과에 합산하지 않고 성공 domain count와 재시도를 유지한다', async () => {
    api.requestGrouped.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(grouped)
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('부동산 4곳')
    expect(wrapper.text()).not.toContain('생활시설 0곳')
    expect(wrapper.text()).toContain('생활시설을 불러오지 못했습니다')
    expect(wrapper.findAll('.search-tab')[0].text()).toBe('전체')
    expect(wrapper.find('[data-testid="ad"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.requestGrouped).toHaveBeenCalledTimes(2)
  })

  it('전부 실패하면 광고와 결과 없음 상태를 렌더하지 않고 영역별 오류를 보인다', async () => {
    api.searchAll.mockRejectedValueOnce(new Error('building unavailable'))
    api.requestGrouped.mockRejectedValueOnce(new Error('facility unavailable'))
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.find('[data-testid="ad"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('부동산을 불러오지 못했습니다')
    expect(wrapper.text()).toContain('생활시설을 불러오지 못했습니다')
  })

  it('전체 탭에서는 URL의 비활성 property/page/facilityCategory를 렌더링과 요청에서 무시한다', async () => {
    routeQuery.tab = 'all'
    routeQuery.property = 'apt'
    routeQuery.page = '4'
    routeQuery.facilityCategory = 'hospital'

    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(api.searchProperty).not.toHaveBeenCalled()
    const labels = wrapper.findAllComponents(SearchResultGroup).map(group => group.props('label'))
    expect(labels).toContain('아파트')
    expect(labels).toContain('병원')
    expect(labels).toContain('화장실')
    expect(labels).toContain('쓰레기')
  })

  it('부동산 유형 페이지에서 q만 바뀌어도 현재 property/page를 새 q로 다시 요청한다', async () => {
    routeQuery.tab = 'buildings'
    routeQuery.property = 'apt'
    routeQuery.page = '2'
    const propertyPage = { items: [], total: 0, page: 2, totalPages: 0 }
    api.searchProperty.mockResolvedValue(propertyPage)
    mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(api.searchProperty).toHaveBeenCalledWith('apt', '강남', 2, 20)

    routeQuery.q = '잠실'
    await nextTick()
    await flushPromises()

    expect(api.searchProperty).toHaveBeenLastCalledWith('apt', '잠실', 2, 20)
  })

  it('활성 property 성공 결과는 overview 부동산 실패와 독립적으로 표시하고 그 결과로 광고를 판단한다', async () => {
    routeQuery.tab = 'buildings'
    routeQuery.property = 'apt'
    api.searchAll.mockRejectedValueOnce(new Error('overview unavailable'))
    api.searchProperty.mockResolvedValueOnce({
      items: [buildings.categories[0].items[0]],
      total: 1,
      page: 1,
      totalPages: 1,
    })

    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('검증아파트0')
    expect(wrapper.text()).not.toContain('부동산을 불러오지 못했습니다')
    expect(wrapper.find('[data-testid="ad"]').exists()).toBe(true)
  })

  it('활성 property 실패는 overview의 양수 count로 가려지거나 광고·빈 결과로 바뀌지 않는다', async () => {
    routeQuery.tab = 'buildings'
    routeQuery.property = 'apt'
    api.searchProperty.mockRejectedValueOnce(new Error('property unavailable'))

    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('부동산 목록을 불러오지 못했습니다')
    expect(wrapper.find('[data-testid="ad"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(false)
  })

  it('탭과 부동산 전체 보기는 q를 보존한 실제 URL 상태를 제공한다', async () => {
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    const tabTos = wrapper.findAll('.search-tab').map(link => link.attributes('href'))
    expect(tabTos).toHaveLength(3)
    const apartment = wrapper.findAllComponents(SearchResultGroup).find(group => group.props('label') === '아파트')!
    expect(apartment.props('moreHref')).toEqual({ path: '/search', query: { q: '강남', tab: 'buildings', property: 'apt' } })
  })

  it('legacy keyword를 q처럼 읽고 noindex follow metadata에서 canonical을 생략한다', async () => {
    delete routeQuery.q
    routeQuery.keyword = '삼성'
    const wrapper = mount(SearchPage, { global: { stubs } })
    await flushPromises()

    expect(wrapper.get('input').element.value).toBe('삼성')
    expect(api.searchAll).toHaveBeenCalledWith('삼성')
    const headFactory = vi.mocked(useHead).mock.calls.at(-1)?.[0] as () => Record<string, unknown>
    const head = headFactory()
    expect(head.title).toBe('삼성 검색 결과 | 일상킷')
    expect(head).not.toHaveProperty('link')
    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
  })
})
