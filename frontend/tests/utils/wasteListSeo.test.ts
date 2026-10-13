import { describe, expect, it } from 'vitest'
import type { RegionScheduleResponse } from '~/composables/useWasteSchedule'
import { wasteListSeo } from '~/utils/wasteListSeo'

const baseQuery = { city: '서울특별시', district: '강남구', page: 1, limit: 20 }
const result = (total: number): RegionScheduleResponse => ({
  schedules: total > 0
    ? [{ id: 1, city: '서울특별시', district: '강남구', targetRegion: '역삼1동', applicableAreas: [], wasteTypes: [] }]
    : [],
  total,
  page: 1,
  totalPages: 1,
})

describe('wasteListSeo', () => {
  it('indexes a successful basic regional source list with its regional canonical', () => {
    expect(wasteListSeo({
      query: baseQuery,
      result: result(1),
      regionalCanonical: '/seoul/gangnam/trash',
      failed: false,
    })).toEqual({ noindex: false, canonical: '/seoul/gangnam/trash' })
  })

  it('does not index empty basic regional source lists', () => {
    expect(wasteListSeo({
      query: baseQuery,
      result: result(0),
      regionalCanonical: '/seoul/gangnam/trash',
      failed: false,
    })).toEqual({ noindex: true, canonical: null })
  })

  it.each([
    ['keyword', { ...baseQuery, keyword: '역삼' }],
    ['areaId', { ...baseQuery, areaId: 1 }],
    ['unresolved', { ...baseQuery, coverage: 'unresolved' as const }],
    ['page2', { ...baseQuery, page: 2 }],
  ])('does not index filtered source lists: %s', (_name, query) => {
    expect(wasteListSeo({
      query,
      result: result(2),
      regionalCanonical: '/seoul/gangnam/trash',
      failed: false,
    })).toEqual({ noindex: true, canonical: null })
  })

  it('leaves failure status for the page HTTP handling rather than creating empty SEO', () => {
    expect(wasteListSeo({
      query: baseQuery,
      result: null,
      regionalCanonical: '/seoul/gangnam/trash',
      failed: true,
    })).toEqual({ noindex: true, canonical: null })
  })
})
