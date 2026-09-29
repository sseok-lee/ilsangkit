import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWasteAreas } from '~/composables/useWasteAreas'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useApiBase', () => '/proxy')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useWasteAreas', () => {
  it('lists waste areas through the area API and forwards query params', async () => {
    const data = { generationId: 'g1', items: [], total: 0, page: 2, totalPages: 1, unresolved: { count: 0, href: null } }
    fetchMock.mockResolvedValue({ success: true, data })

    await expect(useWasteAreas().list({ city: '서울특별시', district: '강남구', keyword: '역삼', page: 2, limit: 20 })).resolves.toBe(data)

    expect(fetchMock).toHaveBeenCalledWith('/proxy/api/waste-areas', {
      query: { city: '서울특별시', district: '강남구', keyword: '역삼', page: 2, limit: 20 },
      signal: undefined,
    })
  })

  it('does not turn failed envelopes or network errors into fallback rows', async () => {
    fetchMock.mockResolvedValueOnce({ success: false })
    await expect(useWasteAreas().list({ page: 1, limit: 20 })).rejects.toThrow('불러오지 못했습니다')

    const error = new Error('network')
    fetchMock.mockRejectedValueOnce(error)
    await expect(useWasteAreas().list({ page: 1, limit: 20 })).rejects.toBe(error)
  })

  it('fetches detail without using legacy source endpoints', async () => {
    const data = { generationId: 'g1', area: { areaId: 1 }, schedules: [], unresolved: { count: 0, href: null } }
    fetchMock.mockResolvedValue({ success: true, data })

    await expect(useWasteAreas().detail(1)).resolves.toBe(data)
    expect(fetchMock.mock.calls[0][0]).toBe('/proxy/api/waste-areas/1')
  })
})
