import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FacilityDetail } from '~/types/facility'

// Mock Nuxt composables
global.useRuntimeConfig = vi.fn(() => ({
  public: {
    apiBase: 'http://localhost:8000',
  },
}))

global.$fetch = vi.fn()

// Import after mocks are set up
const { useFacilityDetail } = await import('../../composables/useFacilityDetail')

describe('useFacilityDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('초기 상태가 올바르게 설정됨', () => {
    const { loading, error, facility } = useFacilityDetail()

    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(facility.value).toBeNull()
  })

  it('시설 상세 정보를 성공적으로 가져옴', async () => {
    const mockFacility: FacilityDetail = {
      id: 'toilet-1',
      category: 'toilet',
      name: '강남역 공중화장실',
      address: '서울특별시 강남구 강남대로 396',
      roadAddress: '서울특별시 강남구 강남대로 396',
      lat: 37.4979,
      lng: 127.0276,
      city: '서울',
      district: '강남구',
      bjdCode: '11680',
      details: {
        operatingHours: '24시간',
        maleToilets: 3,
        maleUrinals: 5,
        femaleToilets: 5,
        hasDisabledToilet: true,
        openTime: '24시간',
        managingOrg: '서울시',
      },
      sourceId: 'src-1',
      sourceUrl: 'https://example.com',
      viewCount: 10,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
    }

    vi.mocked(global.$fetch).mockResolvedValueOnce({ success: true, data: mockFacility })

    const { loading, error, facility, fetchDetail } = useFacilityDetail()

    const result = await fetchDetail('toilet', 'toilet-1')

    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(facility.value).toEqual(mockFacility)
    expect(result).toEqual(mockFacility)
    expect(global.$fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/facilities/toilet/toilet-1'
    )
  })

  it('에러 발생 시 에러 상태 설정', async () => {
    const mockError = new Error('Network error')
    vi.mocked(global.$fetch).mockRejectedValueOnce(mockError)

    const { loading, error, facility, fetchDetail } = useFacilityDetail()

    const result = await fetchDetail('toilet', 'toilet-1')

    expect(loading.value).toBe(false)
    expect(error.value).toBe(mockError)
    expect(facility.value).toBeNull()
    expect(result).toBeNull()
  })

  it('로딩 중 상태 관리', async () => {
    vi.mocked(global.$fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {
                  id: 'toilet-1',
                  category: 'toilet',
                  name: 'Test',
                },
              }),
            100
          )
        )
    )

    const { loading, fetchDetail } = useFacilityDetail()

    const promise = fetchDetail('toilet', 'toilet-1')
    expect(loading.value).toBe(true)

    await promise
    expect(loading.value).toBe(false)
  })

  it('404 에러 시 null 반환', async () => {
    const notFoundError = new Error('Not Found')
    ;(notFoundError as any).statusCode = 404
    vi.mocked(global.$fetch).mockRejectedValueOnce(notFoundError)

    const { error, facility, fetchDetail } = useFacilityDetail()

    const result = await fetchDetail('toilet', 'nonexistent')

    expect(facility.value).toBeNull()
    expect(error.value).toBe(notFoundError)
    expect(result).toBeNull()
  })
})
