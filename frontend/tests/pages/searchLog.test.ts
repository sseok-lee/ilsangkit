import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import SearchPage from '~/pages/search.vue'

// --- mock shared state so we can drive loading transitions ---
const loadingRef = ref(false)
const logSearchMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({
    loading: loadingRef,
    facilities: ref([]),
    total: ref(5),
    currentPage: ref(1),
    totalPages: ref(0),
    error: ref(null),
    groupedResults: ref([]),
    groupedTotalCount: ref(3),
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

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setItemListSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({
    trackSearchResultsView: vi.fn(),
    trackSearchNoResults: vi.fn(),
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: vi.fn().mockResolvedValue({ categories: [] }),
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
  SearchRecovery: { template: '<div />' },
  NuxtLink: { template: '<a><slot /></a>' },
}

describe('/search 검색 로깅 (logSearch)', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    loadingRef.value = false
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

  it('loading true→false 전이 + keyword 있을 때 logSearch가 /api/search/log payload로 호출된다', async () => {
    wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    // Set a search keyword via the input
    const input = wrapper.find('input[aria-label="시설 검색"]')
    await input.setValue('강남')
    await flushPromises()

    // Simulate loading: true → false transition (what happens after performSearch)
    loadingRef.value = true
    await flushPromises()
    loadingRef.value = false
    await flushPromises()

    expect(logSearchMock).toHaveBeenCalledOnce()
    const call = logSearchMock.mock.calls[0][0]
    expect(call.keyword).toBe('강남')
    expect(typeof call.resultCount).toBe('number')
    // resultCount = total(5) + groupedTotalCount(3) + realEstateResults(0) = 8
    expect(call.resultCount).toBe(8)
  })

  it('keyword가 없을 때 logSearch가 호출되지 않는다', async () => {
    wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
    await flushPromises()

    // No keyword set — trigger loading transition
    loadingRef.value = true
    await flushPromises()
    loadingRef.value = false
    await flushPromises()

    expect(logSearchMock).not.toHaveBeenCalled()
  })
})
