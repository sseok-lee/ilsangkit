import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import SearchPage from '~/pages/search.vue'

const logSearchMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

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

vi.mock('~/composables/useWasteSchedule', () => ({
  useWasteSchedule: () => ({
    isLoading: { value: false },
    error: { value: null },
    getCities: vi.fn().mockResolvedValue([]),
    getDistricts: vi.fn().mockResolvedValue([]),
    getSchedules: vi.fn().mockResolvedValue({ schedules: [] }),
  }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({
    trackSearchResultsView: vi.fn(),
    trackSearchNoResults: vi.fn(),
  }),
}))

// /search는 부동산 전용 — resultCount는 부동산 categories count 합으로 산출된다 (시설 병렬 제거)
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: vi.fn().mockResolvedValue({
      categories: [
        { type: 'apt-sale', count: 4, items: [] },
        { type: 'villa-sale', count: 3, items: [] },
      ],
    }),
    getComplexList: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0 }),
  }),
}))

vi.mock('~/composables/useSearchSuggest', () => ({
  useSearchSuggest: () => ({
    items: ref([]),
    popular: ref([]),
    recent: ref([]),
    suggest: vi.fn(),
    loadPopular: vi.fn(),
    logSearch: logSearchMock,
    addRecent: vi.fn(),
    removeRecent: vi.fn(),
    clearRecent: vi.fn(),
    getSessionId: vi.fn().mockReturnValue('test-sid'),
  }),
}))

const globalStubs = {
  FacilityCard: { template: '<div data-testid="facility-card" />' },
  CategoryIcon: { template: '<span />' },
  AdBanner: { template: '<div />' },
  Pagination: { template: '<div />' },
  PageHero: { template: '<div><slot name="search" /></div>' },
  SectionBlock: { template: '<div><slot /><slot name="right" /></div>' },
  EmptyState: { template: '<div><slot /></div>' },
  NuxtLink: { template: '<a><slot /></a>' },
}

describe('/search 검색 로깅 (logSearch)', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    logSearchMock.mockClear()
    localStorage.clear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('컴포넌트가 에러 없이 마운트된다', async () => {
    wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  it('loading true→false 전이 + keyword 있을 때 logSearch가 부동산 결과 합계로 호출된다', async () => {
    wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()
    // 마운트 시 초기 검색(키워드 없음)은 로깅되지 않지만, 방어적으로 초기화
    logSearchMock.mockClear()

    // Set a search keyword and trigger the real search flow (다시 검색 = handleSearch → performSearch)
    const input = wrapper.find('input[aria-label="부동산 검색"]')
    await input.setValue('강남')
    await input.trigger('keyup.enter')
    await flushPromises()

    expect(logSearchMock).toHaveBeenCalledOnce()
    const call = logSearchMock.mock.calls[0][0]
    expect(call.keyword).toBe('강남')
    // resultCount = 부동산 categories count 합 (4 + 3, 시설 병렬 제거)
    expect(call.resultCount).toBe(7)
    expect(call.category).toBe('realestate')
  })

  it('keyword가 없을 때 logSearch가 호출되지 않는다', async () => {
    wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    expect(logSearchMock).not.toHaveBeenCalled()
  })
})
