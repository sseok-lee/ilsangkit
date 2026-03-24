import { describe, it, expect } from 'vitest'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'

describe('RELATED_CATEGORIES', () => {
  it('RELATED_CATEGORIES 객체가 존재한다', () => {
    expect(RELATED_CATEGORIES).toBeDefined()
    expect(typeof RELATED_CATEGORIES).toBe('object')
  })

  it('hospital 키가 존재한다', () => {
    expect(RELATED_CATEGORIES).toHaveProperty('hospital')
    expect(Array.isArray(RELATED_CATEGORIES['hospital'])).toBe(true)
  })

  it('hospital의 관련 카테고리에 pharmacy가 포함된다', () => {
    expect(RELATED_CATEGORIES['hospital']).toContain('pharmacy')
  })

  it('hospital의 관련 카테고리에 hospital이 미포함된다', () => {
    expect(RELATED_CATEGORIES['hospital']).not.toContain('hospital')
  })

  it('school의 관련 카테고리에 childcare가 포함된다', () => {
    expect(RELATED_CATEGORIES['school']).toContain('childcare')
  })

  it('모든 카테고리 값이 배열이다', () => {
    for (const key of Object.keys(RELATED_CATEGORIES)) {
      expect(Array.isArray(RELATED_CATEGORIES[key])).toBe(true)
    }
  })

  it('각 카테고리의 관련 카테고리에 자기 자신이 포함되지 않는다', () => {
    for (const key of Object.keys(RELATED_CATEGORIES)) {
      expect(RELATED_CATEGORIES[key]).not.toContain(key)
    }
  })
})
