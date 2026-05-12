import { describe, it, expect, vi, beforeEach } from 'vitest'

// $fetch 글로벌 모킹 — tests/setup.ts에 기본 stub이 있으나 여기서 케이스별 응답을 주입한다.
const mockFetch = vi.fn()

vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))

import { useRegionFacilities } from '~/composables/useRegionFacilities'

describe('useRegionFacilities — subway branch', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('category === "subway"이면 /api/subway/stations?grouped=true 를 호출한다', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 'g1',
            name: '강남',
            nameSlug: 'gangnam',
            primaryLine: '2호선',
            lines: ['2호선'],
            operator: '서울교통공사',
            lat: 37.4979,
            lng: 127.0276,
            address: null,
            roadAddress: '서울 강남구 강남대로 396',
            city: '서울',
            district: '강남구',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    })

    const { fetchFacilities, facilities, total } = useRegionFacilities()
    await fetchFacilities('seoul', '강남구', 'subway', 1, 20)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/subway/stations',
      expect.objectContaining({
        query: expect.objectContaining({ grouped: true, city: 'seoul', district: '강남구' }),
      }),
    )
    expect(total.value).toBe(1)
    expect(facilities.value).toHaveLength(1)
    expect(facilities.value[0].id).toBe('gangnam') // nameSlug 가 id로 매핑
    expect(facilities.value[0].category).toBe('subway')
    expect(facilities.value[0].extras).toMatchObject({
      primaryLine: '2호선',
      lines: ['2호선'],
    })
  })

  it('category !== "subway"이면 /api/facilities/region/... 을 호출한다 (회귀)', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, totalPages: 0 },
    })

    const { fetchFacilities } = useRegionFacilities()
    await fetchFacilities('seoul', '강남구', 'toilet', 1, 20)

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/facilities/region/seoul/강남구/toilet')
  })

  it('subway 환승역(lines.length > 1)을 정상 정규화한다', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 'jongno-3-ga',
            name: '종로3가',
            nameSlug: 'jongno-3-ga',
            primaryLine: '1호선',
            lines: ['1호선', '3호선', '5호선'],
            operator: null,
            lat: 37.5713,
            lng: 126.9919,
            address: null,
            roadAddress: null,
            city: '서울',
            district: '종로구',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    })

    const { fetchFacilities, facilities } = useRegionFacilities()
    await fetchFacilities('seoul', '종로구', 'subway', 1, 20)
    expect(facilities.value[0].extras?.lines).toEqual(['1호선', '3호선', '5호선'])
  })
})
