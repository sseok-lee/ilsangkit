import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFacilitySearch } from '~/composables/useFacilitySearch'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('useFacilitySearch', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('초기 상태가 올바른지 확인', () => {
    const { loading, facilities, total, currentPage, totalPages, error } = useFacilitySearch()

    expect(loading.value).toBe(false)
    expect(facilities.value).toEqual([])
    expect(total.value).toBe(0)
    expect(currentPage.value).toBe(1)
    expect(totalPages.value).toBe(0)
    expect(error.value).toBeNull()
  })

  it('검색 시 로딩 상태가 변경되는지 확인', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
    })

    const { loading, search } = useFacilitySearch()

    const searchPromise = search({ keyword: '강남' })
    expect(loading.value).toBe(true)

    await searchPromise
    expect(loading.value).toBe(false)
  })

  it('검색 성공 시 시설 목록이 업데이트되는지 확인', async () => {
    const mockData = {
      success: true,
      data: {
        items: [
          {
            id: 'toilet-1',
            name: '강남역 지하 공중화장실',
            category: 'toilet',
            address: '서울특별시 강남구 강남대로 396',
            lat: 37.4979,
            lng: 127.0276,
            distance: 150,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      },
    }

    mockFetch.mockResolvedValue(mockData)

    const { facilities, total, currentPage, totalPages, search } = useFacilitySearch()
    await search({ keyword: '강남' })

    expect(facilities.value).toEqual(mockData.data.items)
    expect(total.value).toBe(1)
    expect(currentPage.value).toBe(1)
    expect(totalPages.value).toBe(1)
  })

  it('검색 실패 시 에러가 설정되는지 확인', async () => {
    const errorMessage = '서버 오류'
    mockFetch.mockRejectedValue(new Error(errorMessage))

    const { error, search } = useFacilitySearch()
    await search({ keyword: '강남' })

    expect(error.value).toContain(errorMessage)
  })

  it('카테고리 필터링이 올바르게 동작하는지 확인', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
    })

    const { search } = useFacilitySearch()
    await search({ category: 'toilet' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ category: 'toilet' }),
      })
    )
  })

  it('페이지네이션이 올바르게 동작하는지 확인', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 2,
        totalPages: 5,
      },
    })

    const { currentPage, totalPages, search } = useFacilitySearch()
    await search({ page: 2 })

    expect(currentPage.value).toBe(2)
    expect(totalPages.value).toBe(5)
  })

  it('정렬 옵션이 올바르게 전달되는지 확인', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
    })

    const { search } = useFacilitySearch()
    await search({ sort: 'distance' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ sort: 'distance' }),
      })
    )
  })
})
