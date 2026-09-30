import { effectScope, isReadonly } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnifiedSearch } from '~/composables/useUnifiedSearch'
import type { GroupedSearchResponse } from '~/types/facility'
import type { ComplexListResponse, RealEstateGroupedResponse } from '~/types/realEstate'

const api = vi.hoisted(() => ({
  searchAll: vi.fn(),
  searchPropertyComplexesByKeyword: vi.fn(),
  requestGrouped: vi.fn(),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: api.searchAll,
    searchPropertyComplexesByKeyword: api.searchPropertyComplexesByKeyword,
  }),
}))

vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({ requestGrouped: api.requestGrouped }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

const buildingsA: RealEstateGroupedResponse = {
  categories: [],
  totalCount: 1,
  buildingCounts: { apt: 1, villa: 0, offitel: 0 },
}
const buildingsB: RealEstateGroupedResponse = {
  categories: [],
  totalCount: 2,
  buildingCounts: { apt: 2, villa: 0, offitel: 0 },
}
const facilitiesA: GroupedSearchResponse = { categories: [], totalCount: 10 }
const facilitiesB: GroupedSearchResponse = { categories: [], totalCount: 20 }
const propertyPage: ComplexListResponse = { items: [], total: 21, page: 2, totalPages: 3 }

describe('useUnifiedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.searchAll.mockResolvedValue(buildingsA)
    api.requestGrouped.mockResolvedValue(facilitiesA)
    api.searchPropertyComplexesByKeyword.mockResolvedValue(propertyPage)
  })

  it('readonly인 세 영역 상태를 idle로 시작한다', () => {
    const search = useUnifiedSearch()

    expect(isReadonly(search.buildings)).toBe(true)
    expect(isReadonly(search.facilities)).toBe(true)
    expect(isReadonly(search.propertyResults)).toBe(true)
    expect(search.buildings.value).toEqual({ status: 'idle', data: null, error: null, keyword: '' })
    expect(search.facilities.value).toEqual({ status: 'idle', data: null, error: null, keyword: '' })
    expect(search.propertyResults.value).toEqual({ status: 'idle', data: null, error: null, keyword: '' })
  })

  it('빈 검색어는 요청하지 않고 모든 영역을 초기화한다', async () => {
    const search = useUnifiedSearch()
    await search.search('   ')

    expect(api.searchAll).not.toHaveBeenCalled()
    expect(api.requestGrouped).not.toHaveBeenCalled()
    expect(api.searchPropertyComplexesByKeyword).not.toHaveBeenCalled()
    expect(search.buildings.value.status).toBe('idle')
  })

  it('부동산과 시설을 독립적으로 요청하고 시설 그룹당 preview limit 3을 전달한다', async () => {
    const search = useUnifiedSearch()
    await search.search(' 강남 ')

    expect(api.searchAll).toHaveBeenCalledWith('강남')
    expect(api.requestGrouped).toHaveBeenCalledWith({ keyword: '강남', limit: 3 })
    expect(search.buildings.value).toEqual({ status: 'success', data: buildingsA, error: null, keyword: '강남' })
    expect(search.facilities.value).toEqual({ status: 'success', data: facilitiesA, error: null, keyword: '강남' })
  })

  it('부동산 성공과 시설 실패를 분리해 성공 데이터와 실제 count를 유지한다', async () => {
    api.requestGrouped.mockRejectedValueOnce(new Error('facility unavailable'))
    const search = useUnifiedSearch()

    await search.search('강남')

    expect(search.buildings.value.data?.buildingCounts?.apt).toBe(1)
    expect(search.buildings.value.status).toBe('success')
    expect(search.facilities.value).toEqual({
      status: 'error',
      data: null,
      error: '생활시설을 불러오지 못했습니다',
      keyword: '강남',
    })
  })

  it('A 이후 B 검색이 먼저 끝나면 늦은 A 응답이 B 상태를 덮어쓰지 않는다', async () => {
    const aBuildings = deferred<RealEstateGroupedResponse>()
    const bBuildings = deferred<RealEstateGroupedResponse>()
    const aFacilities = deferred<GroupedSearchResponse>()
    const bFacilities = deferred<GroupedSearchResponse>()
    api.searchAll.mockReturnValueOnce(aBuildings.promise).mockReturnValueOnce(bBuildings.promise)
    api.requestGrouped.mockReturnValueOnce(aFacilities.promise).mockReturnValueOnce(bFacilities.promise)
    const search = useUnifiedSearch()

    const searchA = search.search('A')
    const searchB = search.search('B')
    bBuildings.resolve(buildingsB)
    bFacilities.resolve(facilitiesB)
    await searchB
    aBuildings.resolve(buildingsA)
    aFacilities.resolve(facilitiesA)
    await searchA

    expect(search.buildings.value).toEqual({ status: 'success', data: buildingsB, error: null, keyword: 'B' })
    expect(search.facilities.value).toEqual({ status: 'success', data: facilitiesB, error: null, keyword: 'B' })
  })

  it('clear 이후 같은 키워드 재시도의 늦은 응답도 무시한다', async () => {
    const retryBuildings = deferred<RealEstateGroupedResponse>()
    api.searchAll.mockRejectedValueOnce(new Error('first failure')).mockReturnValueOnce(retryBuildings.promise)
    const search = useUnifiedSearch()
    await search.search('강남')

    const retry = search.retry('buildings')
    search.clear()
    retryBuildings.resolve(buildingsB)
    await retry

    expect(search.buildings.value).toEqual({ status: 'idle', data: null, error: null, keyword: '' })
  })

  it('scope disposal 이후 같은 키워드 재시도의 늦은 응답도 무시한다', async () => {
    const retryFacilities = deferred<GroupedSearchResponse>()
    api.requestGrouped.mockRejectedValueOnce(new Error('first failure')).mockReturnValueOnce(retryFacilities.promise)
    const scope = effectScope()
    const search = scope.run(() => useUnifiedSearch())!
    await search.search('강남')

    const retry = search.retry('facilities')
    scope.stop()
    retryFacilities.resolve(facilitiesB)
    await retry

    expect(search.facilities.value.status).toBe('pending')
    expect(search.facilities.value.data).toBeNull()
  })

  it('유형 페이지 요청은 overview와 별도 상태 및 token으로 관리한다', async () => {
    const stalePage = deferred<ComplexListResponse>()
    api.searchPropertyComplexesByKeyword.mockReturnValueOnce(stalePage.promise)
    const search = useUnifiedSearch()

    const propertyRequest = search.loadProperty('강남', 'apt', 1)
    await search.search('잠실')
    stalePage.resolve({ ...propertyPage, page: 1 })
    await propertyRequest

    expect(api.searchPropertyComplexesByKeyword).toHaveBeenCalledWith('apt', '강남', 1, 20)
    expect(search.propertyResults.value).toEqual({ status: 'idle', data: null, error: null, keyword: '' })
    expect(search.buildings.value.keyword).toBe('잠실')
  })

  it('property 실패를 같은 요청 인자로 재시도해 실제 count를 복구한다', async () => {
    api.searchPropertyComplexesByKeyword
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(propertyPage)
    const search = useUnifiedSearch()
    await search.loadProperty('강남', 'villa', 2)

    expect(search.propertyResults.value.status).toBe('error')
    await search.retry('property')

    expect(api.searchPropertyComplexesByKeyword).toHaveBeenLastCalledWith('villa', '강남', 2, 20)
    expect(search.propertyResults.value.data?.total).toBe(21)
    expect(search.propertyResults.value.status).toBe('success')
  })
})
