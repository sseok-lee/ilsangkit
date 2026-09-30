import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SearchPage from '~/pages/search.vue'

const api = vi.hoisted(() => ({ searchAll: vi.fn(), searchProperty: vi.fn(), requestGrouped: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { q: '래미안', tab: 'buildings', property: 'apt', page: '2' } }),
}))
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({ searchAll: api.searchAll, searchPropertyComplexesByKeyword: api.searchProperty }),
}))
vi.mock('~/composables/useFacilitySearch', () => ({ useFacilitySearch: () => ({ requestGrouped: api.requestGrouped }) }))
vi.mock('~/composables/useFacilityMeta', () => ({ useFacilityMeta: () => ({ setSearchMeta: vi.fn() }) }))
vi.mock('~/composables/useAnalytics', () => ({ useAnalytics: () => ({ trackSearchResultsView: vi.fn(), trackSearchNoResults: vi.fn() }) }))
vi.mock('~/composables/useSearchSuggest', () => ({ useSearchSuggest: () => ({ logSearch: vi.fn(), items: ref([]) }) }))

const propertyPage = {
  items: [{
    type: 'apt-rent',
    buildingName: '래미안강남',
    bjdCode: '11680',
    city: '서울',
    district: '강남구',
    dongName: '역삼동',
    latestPrice: 70000,
    transactionCount: 12,
    lat: null,
    lng: null,
    lastDealYear: 2026,
    lastDealMonth: 9,
    buildYear: 2010,
    latestDeals: {
      sale: null,
      jeonse: null,
      wolse: { kind: 'wolse', amount: null, deposit: 70000, monthlyRent: 250, exclusiveArea: 59.8, floor: 8, dealYear: 2026, dealMonth: 9, dealDay: 3 },
    },
  }],
  page: 2,
  totalPages: 7,
  total: 41,
}

describe('검색 결과 부동산 URL과 atomic 거래 행', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.searchAll.mockResolvedValue({ categories: [], buildingCounts: { apt: 41, villa: 0, offitel: 0 } })
    api.requestGrouped.mockResolvedValue({ categories: [], totalCount: 0 })
    api.searchProperty.mockResolvedValue(propertyPage)
  })

  it('q/property/page를 API에 전달하고 representative 거래의 정식 상세 URL과 페이지 href를 만든다', async () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: {
          AdBanner: { template: '<div />' },
          EmptyState: { template: '<div />' },
        },
      },
    })
    await flushPromises()

    expect(api.searchProperty).toHaveBeenCalledWith('apt', '래미안', 2, 20)
    const buildingLink = wrapper.findAll('a').find(link => link.text().includes('래미안강남'))!
    expect(buildingLink.attributes('href')).toBe(`/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('래미안강남')}?mode=wolse`)
    expect(buildingLink.text()).toContain('보증금 7억 / 월세 250만원')
    expect(buildingLink.text()).toContain('59.8㎡')
    expect(buildingLink.text()).toContain('8층')
    const pagination = wrapper.get('nav[aria-label="부동산 검색 페이지"]')
    expect(pagination.find('button').exists()).toBe(false)
    const pages = pagination.findAll('a.search-pagination__page')
    expect(pages.map(link => link.text())).toEqual(['1', '2', '3', '7'])
    expect(pages[0].attributes('href')).toBe('/search?q=%EB%9E%98%EB%AF%B8%EC%95%88&tab=buildings&property=apt')
    expect(pages[1].attributes('href')).toBe('/search?q=%EB%9E%98%EB%AF%B8%EC%95%88&tab=buildings&property=apt&page=2')
    expect(pages[1].attributes('aria-current')).toBe('page')
    expect(pages[2].attributes('href')).toBe('/search?q=%EB%9E%98%EB%AF%B8%EC%95%88&tab=buildings&property=apt&page=3')
    expect(pages[3].attributes('href')).toBe('/search?q=%EB%9E%98%EB%AF%B8%EC%95%88&tab=buildings&property=apt&page=7')
    expect(pagination.text()).toContain('…')
    expect(pagination.get('a[aria-label="이전 페이지"]').attributes('aria-current')).toBe('false')
    expect(pagination.get('a[aria-label="다음 페이지"]').attributes('aria-current')).toBe('false')
  })
})
