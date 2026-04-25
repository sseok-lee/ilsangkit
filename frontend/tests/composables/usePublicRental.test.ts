import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePublicRental } from '~/composables/usePublicRental'
import type {
  PublicRentalListResponse,
  PublicRentalComplex,
} from '~/types/publicRental'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))

const baseRow: PublicRentalComplex = {
  id: 1,
  complexCode: '12345',
  complexName: '강남 매입임대 1단지',
  city: '서울특별시',
  district: '강남구',
  rentalType: '매입임대',
  houseType: '아파트',
  householdCount: 80,
  exclusiveArea: 59.96,
  depositAmount: 80000000,
  monthlyRent: 200000,
  landlordAgency: 'LH',
  sourceId: 'lh-12345',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-25T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePublicRental.fetchList', () => {
  it('populates items + pagination on success', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [baseRow],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      } as PublicRentalListResponse,
    })

    const { items, total, totalPages, currentPage, fetchList, error } = usePublicRental()
    await fetchList({ city: 'seoul', rentalType: '매입임대' })

    expect(items.value).toHaveLength(1)
    expect(items.value[0].complexName).toBe('강남 매입임대 1단지')
    expect(total.value).toBe(1)
    expect(totalPages.value).toBe(1)
    expect(currentPage.value).toBe(1)
    expect(error.value).toBeNull()

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:8000/api/public-rental')
    expect(options.query).toEqual({ city: 'seoul', rentalType: '매입임대' })
  })

  it('sets error and resets state on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const { items, total, fetchList, error } = usePublicRental()
    await fetchList()
    expect(items.value).toEqual([])
    expect(total.value).toBe(0)
    expect(error.value).toBe('network down')
  })
})

describe('usePublicRental.fetchDetail', () => {
  it('populates detail on success', async () => {
    mockFetch.mockResolvedValueOnce({ success: true, data: baseRow })
    const { detail, fetchDetail } = usePublicRental()
    await fetchDetail(1)
    expect(detail.value?.id).toBe(1)
    expect(detail.value?.depositAmount).toBe(80000000)
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/api/public-rental/1')
  })

  it('clears detail on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('not found'))
    const { detail, fetchDetail, error } = usePublicRental()
    await fetchDetail(999)
    expect(detail.value).toBeNull()
    expect(error.value).toBe('not found')
  })
})

