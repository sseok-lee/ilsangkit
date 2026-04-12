import { describe, it, expect } from 'vitest'
import {
  categoryToSlug,
  slugToCategory,
  REAL_ESTATE_CATEGORIES,
  REAL_ESTATE_TYPES,
  type RealEstateCategory,
  type RealEstateType,
} from '../../types/realEstate'

describe('categoryToSlug', () => {
  it('aptSale -> apt-sale', () => {
    expect(categoryToSlug('aptSale')).toBe('apt-sale')
  })

  it('aptRent -> apt-rent', () => {
    expect(categoryToSlug('aptRent')).toBe('apt-rent')
  })

  it('villaSale -> villa-sale', () => {
    expect(categoryToSlug('villaSale')).toBe('villa-sale')
  })

  it('villaRent -> villa-rent', () => {
    expect(categoryToSlug('villaRent')).toBe('villa-rent')
  })

  it('offitelSale -> offitel-sale', () => {
    expect(categoryToSlug('offitelSale')).toBe('offitel-sale')
  })

  it('offitelRent -> offitel-rent', () => {
    expect(categoryToSlug('offitelRent')).toBe('offitel-rent')
  })

  it('모든 카테고리가 대응되는 slug를 반환해야 한다', () => {
    const allMapped = REAL_ESTATE_CATEGORIES.every(
      (cat) => REAL_ESTATE_TYPES.includes(categoryToSlug(cat))
    )
    expect(allMapped).toBe(true)
  })
})

describe('slugToCategory', () => {
  it('apt-sale -> aptSale', () => {
    expect(slugToCategory('apt-sale')).toBe('aptSale')
  })

  it('apt-rent -> aptRent', () => {
    expect(slugToCategory('apt-rent')).toBe('aptRent')
  })

  it('villa-sale -> villaSale', () => {
    expect(slugToCategory('villa-sale')).toBe('villaSale')
  })

  it('villa-rent -> villaRent', () => {
    expect(slugToCategory('villa-rent')).toBe('villaRent')
  })

  it('offitel-sale -> offitelSale', () => {
    expect(slugToCategory('offitel-sale')).toBe('offitelSale')
  })

  it('offitel-rent -> offitelRent', () => {
    expect(slugToCategory('offitel-rent')).toBe('offitelRent')
  })

  it('모든 slug가 대응되는 카테고리를 반환해야 한다', () => {
    const allMapped = REAL_ESTATE_TYPES.every(
      (slug) => REAL_ESTATE_CATEGORIES.includes(slugToCategory(slug))
    )
    expect(allMapped).toBe(true)
  })
})

describe('REAL_ESTATE_CATEGORIES', () => {
  it('6개 카테고리를 포함해야 한다', () => {
    expect(REAL_ESTATE_CATEGORIES).toHaveLength(6)
  })

  it('모든 카테고리 값을 포함해야 한다', () => {
    const expected: RealEstateCategory[] = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent']
    expected.forEach((cat) => {
      expect(REAL_ESTATE_CATEGORIES).toContain(cat)
    })
  })
})

describe('REAL_ESTATE_TYPES', () => {
  it('6개 타입(slug)을 포함해야 한다', () => {
    expect(REAL_ESTATE_TYPES).toHaveLength(6)
  })

  it('모든 slug 값을 포함해야 한다', () => {
    const expected: RealEstateType[] = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']
    expected.forEach((slug) => {
      expect(REAL_ESTATE_TYPES).toContain(slug)
    })
  })
})

describe('categoryToSlug/slugToCategory 왕복 변환', () => {
  it('category -> slug -> category 동일해야 한다', () => {
    REAL_ESTATE_CATEGORIES.forEach((cat) => {
      expect(slugToCategory(categoryToSlug(cat))).toBe(cat)
    })
  })

  it('slug -> category -> slug 동일해야 한다', () => {
    REAL_ESTATE_TYPES.forEach((slug) => {
      expect(categoryToSlug(slugToCategory(slug))).toBe(slug)
    })
  })
})
