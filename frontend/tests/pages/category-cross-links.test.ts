import { describe, it, expect } from 'vitest'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
import { CATEGORY_META } from '~/types/facility'

describe('RELATED_CATEGORIES - 카테고리 간 교차 링크', () => {
  it('hospital의 관련 카테고리에 pharmacy가 포함된다', () => {
    expect(RELATED_CATEGORIES['hospital']).toContain('pharmacy')
  })

  it('hospital의 관련 카테고리에 hospital 자신은 미포함된다', () => {
    const related = RELATED_CATEGORIES['hospital'] || []
    expect(related).not.toContain('hospital')
  })

  it('school의 관련 카테고리에 childcare가 포함된다', () => {
    expect(RELATED_CATEGORIES['school']).toContain('childcare')
  })

  it('관련 카테고리 배열이 비어있지 않은 카테고리가 최소 10개이다', () => {
    const nonEmpty = Object.entries(RELATED_CATEGORIES).filter(
      ([, related]) => related.length > 0,
    )
    expect(nonEmpty.length).toBeGreaterThanOrEqual(10)
  })

  it('관련 카테고리 슬러그들이 CATEGORY_META에 존재하는 유효한 카테고리이다', () => {
    for (const [, related] of Object.entries(RELATED_CATEGORIES)) {
      for (const slug of related) {
        expect(
          CATEGORY_META[slug as keyof typeof CATEGORY_META],
          `"${slug}"은 유효한 카테고리가 아닙니다`,
        ).toBeDefined()
      }
    }
  })
})
