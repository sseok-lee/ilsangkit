import { describe, expect, it } from 'vitest'
import { changeBrowseRegion, normalizeFacilityBrowseQuery, toFacilityBrowseQuery } from '~/utils/facilityBrowseQuery'

describe('facility browse URL', () => {
  it('omits defaults and restores submitted category/page/search', () => {
    expect(toFacilityBrowseQuery(normalizeFacilityBrowseQuery({}))).toEqual({})
    const filters = normalizeFacilityBrowseQuery({ city: 'seoul', district: 'gangnam', category: 'parking', q: '  중앙  ', page: '2' })
    expect(toFacilityBrowseQuery(filters)).toEqual({ city: 'seoul', district: 'gangnam', category: 'parking', q: '중앙', page: '2' })
  })
  it('uses the first query value and accepts only positive safe integer pages', () => {
    expect(normalizeFacilityBrowseQuery({ city: ['seoul', 'busan'], category: ['subway'], page: ['2', '3'] })).toMatchObject({ city: 'seoul', category: 'subway', page: 2 })
    for (const page of ['0', '-1', '1.5', '2x', 'Infinity', '9007199254740992']) {
      expect(normalizeFacilityBrowseQuery({ category: 'parking', page }).page).toBe(1)
    }
  })
  it('drops list-only filters in grouped mode and for unknown categories', () => {
    for (const category of ['', 'invalid']) {
      expect(normalizeFacilityBrowseQuery({ category, page: '5', departments: '내과' })).toMatchObject({ category: '', page: 1, departments: [] })
    }
    expect(normalizeFacilityBrowseQuery({ category: 'parking', departments: '내과' }).departments).toEqual([])
  })
  it('keeps hospital departments distinct and round-trips them', () => {
    const filters = normalizeFacilityBrowseQuery({ category: 'hospital', departments: ' 내과,소아청소년과,내과,, ' })
    expect(filters.departments).toEqual(['내과', '소아청소년과'])
    expect(normalizeFacilityBrowseQuery(toFacilityBrowseQuery(filters))).toEqual(filters)
  })
  it('clears dependent region state while preserving category and search', () => {
    expect(changeBrowseRegion({ city: 'seoul', district: 'gangnam', category: 'hospital', q: '중앙', page: 2, departments: ['내과'] }, 'busan')).toEqual({ city: 'busan', district: '', category: 'hospital', q: '중앙', page: 1, departments: [] })
  })
  it('rejects an overlong submitted search rather than silently changing it', () => {
    expect(() => normalizeFacilityBrowseQuery({ q: '가'.repeat(101) })).toThrow('100자')
    expect(normalizeFacilityBrowseQuery({ q: '가'.repeat(100) }).q).toHaveLength(100)
  })
})
