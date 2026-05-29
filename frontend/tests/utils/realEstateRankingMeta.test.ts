import { describe, it, expect } from 'vitest'
import { RANKING_META, RANKING_FAQ } from '~/utils/realEstateMeta'
import { REAL_ESTATE_URL_TYPES } from '~/utils/realEstateUrl'

describe('RANKING_META / RANKING_FAQ', () => {
  it('6개 타입 모두 고유 title/description 보유', () => {
    for (const t of REAL_ESTATE_URL_TYPES) {
      expect(RANKING_META[t].title.length).toBeGreaterThan(5)
      expect(RANKING_META[t].description.length).toBeGreaterThan(10)
    }
    const titles = REAL_ESTATE_URL_TYPES.map((t) => RANKING_META[t].title)
    expect(new Set(titles).size).toBe(titles.length)
  })
  it('각 타입 FAQ 4문항 이상', () => {
    for (const t of REAL_ESTATE_URL_TYPES) {
      expect(RANKING_FAQ[t].length).toBeGreaterThanOrEqual(4)
    }
  })
})
