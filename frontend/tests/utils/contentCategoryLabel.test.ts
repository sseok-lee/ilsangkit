import { describe, expect, it } from 'vitest'
import { getContentCategoryLabel } from '~/utils/contentCategoryLabel'

describe('getContentCategoryLabel', () => {
  it('apt-sale/apt-rent는 "부동산"으로 특수 매핑된다', () => {
    expect(getContentCategoryLabel('apt-sale')).toBe('부동산')
    expect(getContentCategoryLabel('apt-rent')).toBe('부동산')
  })

  it('subscription은 "청약/임대"로 특수 매핑된다', () => {
    expect(getContentCategoryLabel('subscription')).toBe('청약/임대')
  })

  it('시설 카테고리는 CATEGORY_META 라벨을 반환한다', () => {
    expect(getContentCategoryLabel('pharmacy')).toBe('약국')
  })

  it('apt-sale 계열이 아닌 부동산 카테고리는 REAL_ESTATE_META(camelKey) 라벨을 반환한다', () => {
    expect(getContentCategoryLabel('villa-sale')).toBe('빌라매매')
  })

  it('삭제된 legacy slug public-rental은 "매입임대"로 폴백한다 (raw slug 미노출)', () => {
    expect(getContentCategoryLabel('public-rental')).toBe('매입임대')
  })

  it('미지정 slug는 raw 노출 대신 안전 폴백 "생활정보"를 반환한다', () => {
    const result = getContentCategoryLabel('xyz')
    expect(result).toBe('생활정보')
    expect(result).not.toContain('xyz')
  })
})
