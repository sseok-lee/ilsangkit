import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFacilityBrowse } from '~/composables/useFacilityBrowse'
import type { BrowseFilters } from '~/types/facilityBrowse'

vi.mock('~/composables/useApiBase', () => ({ useApiBase: () => '/proxy' }))
const fetchMock = vi.fn()
const filters: BrowseFilters = { city: 'seoul', district: 'gangnam', category: 'hospital', q: '중앙', page: 2, departments: ['내과', '소아청소년과'] }

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('$fetch', fetchMock) })

describe('useFacilityBrowse', () => {
  it('maps URL filters to the API contract and forwards cancellation', async () => {
    const data = { mode: 'list', category: 'hospital', unit: '시설', items: [], total: 0, page: 2, totalPages: 0 }
    fetchMock.mockResolvedValue({ success: true, data })
    const signal = new AbortController().signal
    expect(await useFacilityBrowse().fetchBrowse(filters, signal)).toEqual(data)
    expect(fetchMock).toHaveBeenCalledWith('/proxy/api/facilities/browse', {
      signal, query: { city: 'seoul', district: 'gangnam', category: 'hospital', keyword: '중앙', page: 2, limit: 20, departments: '내과,소아청소년과' },
    })
  })
  it('never requests national results for an incomplete region', async () => {
    for (const region of [{ city: '', district: '' }, { city: 'seoul', district: '' }, { city: '', district: 'gangnam' }]) {
      await expect(useFacilityBrowse().fetchBrowse({ ...filters, ...region })).rejects.toThrow('지역')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not query with overlong search input', async () => {
    await expect(useFacilityBrowse().fetchBrowse({ ...filters, q: '가'.repeat(101) })).rejects.toThrow('100자')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('omits list-only filters when browsing grouped results', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { mode: 'grouped', groups: [] } })
    await useFacilityBrowse().fetchBrowse({ ...filters, category: '', q: '' })
    expect(fetchMock.mock.calls[0][1].query).toEqual({ city: 'seoul', district: 'gangnam', category: undefined, keyword: undefined, page: 1, limit: 20, departments: undefined })
  })
  it('propagates network and unsuccessful envelope errors, never treating them as empty', async () => {
    const failure = new Error('network failure')
    fetchMock.mockRejectedValueOnce(failure)
    await expect(useFacilityBrowse().fetchBrowse(filters)).rejects.toBe(failure)
    for (const response of [{ success: false }, { success: true, data: null }]) {
      fetchMock.mockResolvedValueOnce(response)
      await expect(useFacilityBrowse().fetchBrowse(filters)).rejects.toThrow('불러오지 못했습니다')
    }
  })
})
