import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import SearchPage from '~/pages/search.vue'

enableAutoUnmount(afterEach)

const routeQuery = reactive<Record<string, string>>({ q: '강남' })
const api = vi.hoisted(() => ({
  searchAll: vi.fn(),
  searchProperty: vi.fn(),
  requestGrouped: vi.fn(),
  logSearch: vi.fn(),
  trackView: vi.fn(),
  trackNoResults: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ query: routeQuery }) }))
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({ searchAll: api.searchAll, searchPropertyComplexesByKeyword: api.searchProperty }),
}))
vi.mock('~/composables/useFacilitySearch', () => ({ useFacilitySearch: () => ({ requestGrouped: api.requestGrouped }) }))
vi.mock('~/composables/useFacilityMeta', () => ({ useFacilityMeta: () => ({ setSearchMeta: vi.fn() }) }))
vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackSearchResultsView: api.trackView, trackSearchNoResults: api.trackNoResults }),
}))
vi.mock('~/composables/useSearchSuggest', () => ({ useSearchSuggest: () => ({ logSearch: api.logSearch, items: ref([]) }) }))

describe('/search 검색 로깅', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeQuery.q = '강남'
    delete routeQuery.tab
    delete routeQuery.property
    delete routeQuery.page
    api.searchAll.mockResolvedValue({ categories: [], buildingCounts: { apt: 4, villa: 3, offitel: 0 } })
    api.requestGrouped.mockResolvedValue({ categories: [], totalCount: 5 })
    api.searchProperty.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 })
  })

  it('성공한 domain count 합계로 한 번 기록하고 탭 변경에는 중복 기록하지 않는다', async () => {
    mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await flushPromises()

    expect(api.logSearch).toHaveBeenCalledOnce()
    expect(api.logSearch).toHaveBeenCalledWith({ keyword: '강남', resultCount: 12, category: 'unified' })
    expect(api.trackView).toHaveBeenCalledOnce()

    routeQuery.tab = 'facilities'
    await nextTick()
    await flushPromises()

    expect(api.searchAll).toHaveBeenCalledOnce()
    expect(api.requestGrouped).toHaveBeenCalledOnce()
    expect(api.logSearch).toHaveBeenCalledOnce()
  })

  it('부분 성공은 통합 count 분석으로 기록하지 않는다', async () => {
    api.requestGrouped.mockRejectedValueOnce(new Error('unavailable'))
    mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await flushPromises()

    expect(api.logSearch).not.toHaveBeenCalled()
    expect(api.trackView).not.toHaveBeenCalled()
    expect(api.trackNoResults).not.toHaveBeenCalled()
  })

  it('부분 성공 0건과 전체 실패를 no-results로 기록하지 않는다', async () => {
    api.searchAll.mockResolvedValueOnce({ categories: [], buildingCounts: { apt: 0, villa: 0, offitel: 0 } })
    api.requestGrouped.mockRejectedValueOnce(new Error('unavailable'))
    const partial = mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await flushPromises()

    expect(api.trackNoResults).not.toHaveBeenCalled()
    expect(api.logSearch).not.toHaveBeenCalled()
    partial.unmount()

    vi.clearAllMocks()
    api.searchAll.mockRejectedValueOnce(new Error('unavailable'))
    api.requestGrouped.mockRejectedValueOnce(new Error('unavailable'))
    mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await flushPromises()

    expect(api.trackNoResults).not.toHaveBeenCalled()
    expect(api.logSearch).not.toHaveBeenCalled()
  })

  it('실제 useUnifiedSearch에서 늦은 A 응답이 현재 B 분석을 중복 기록하지 않는다', async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve })
      return { promise, resolve }
    }
    const aBuildings = deferred<{ categories: never[]; buildingCounts: { apt: number; villa: number; offitel: number } }>()
    const aFacilities = deferred<{ categories: never[]; totalCount: number }>()
    const bBuildings = deferred<{ categories: never[]; buildingCounts: { apt: number; villa: number; offitel: number } }>()
    const bFacilities = deferred<{ categories: never[]; totalCount: number }>()
    api.searchAll.mockReset().mockReturnValueOnce(aBuildings.promise).mockReturnValueOnce(bBuildings.promise)
    api.requestGrouped.mockReset().mockReturnValueOnce(aFacilities.promise).mockReturnValueOnce(bFacilities.promise)

    mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await nextTick()
    routeQuery.q = '잠실'
    await nextTick()

    bBuildings.resolve({ categories: [], buildingCounts: { apt: 2, villa: 0, offitel: 0 } })
    bFacilities.resolve({ categories: [], totalCount: 20 })
    await flushPromises()

    expect(api.logSearch).toHaveBeenCalledOnce()
    expect(api.logSearch).toHaveBeenCalledWith({ keyword: '잠실', resultCount: 22, category: 'unified' })

    aBuildings.resolve({ categories: [], buildingCounts: { apt: 1, villa: 0, offitel: 0 } })
    aFacilities.resolve({ categories: [], totalCount: 10 })
    await flushPromises()

    expect(api.logSearch).toHaveBeenCalledOnce()
    expect(api.trackView).toHaveBeenCalledOnce()
  })

  it('페이지가 dispose된 뒤 완료된 요청은 분석을 기록하지 않는다', async () => {
    let resolveBuildings!: (value: { categories: never[]; buildingCounts: { apt: number; villa: number; offitel: number } }) => void
    let resolveFacilities!: (value: { categories: never[]; totalCount: number }) => void
    api.searchAll.mockReset().mockReturnValueOnce(new Promise(resolve => { resolveBuildings = resolve }))
    api.requestGrouped.mockReset().mockReturnValueOnce(new Promise(resolve => { resolveFacilities = resolve }))

    const wrapper = mount(SearchPage, { global: { stubs: { AdBanner: { template: '<div />' }, EmptyState: { template: '<div />' } } } })
    await nextTick()
    wrapper.unmount()
    resolveBuildings({ categories: [], buildingCounts: { apt: 1, villa: 0, offitel: 0 } })
    resolveFacilities({ categories: [], totalCount: 1 })
    await flushPromises()

    expect(api.logSearch).not.toHaveBeenCalled()
    expect(api.trackView).not.toHaveBeenCalled()
  })
})
