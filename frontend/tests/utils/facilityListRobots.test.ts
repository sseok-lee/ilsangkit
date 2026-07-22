import { describe, it, expect } from 'vitest'
import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'

describe('shouldNoindexFacilityList', () => {
  it('기본(page1, keyword 없음) → 색인 허용(false)', () => {
    expect(shouldNoindexFacilityList({ page: 1 })).toBe(false)
  })
  it('?city= 만(page1) → 색인 허용(false)', () => {
    expect(shouldNoindexFacilityList({ page: 1, keyword: '' })).toBe(false)
  })
  it('keyword 존재 → noindex(true)', () => {
    expect(shouldNoindexFacilityList({ page: 1, keyword: '역삼' })).toBe(true)
  })
  it('page2+ → noindex(true)', () => {
    expect(shouldNoindexFacilityList({ page: 2 })).toBe(true)
  })
})
