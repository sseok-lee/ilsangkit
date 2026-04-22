import { describe, it, expect } from 'vitest'
import type { FacilityCategory } from '~/types/facility'
import {
  CATEGORY_GROUPS,
  CATEGORY_META,
  FACILITY_CATEGORIES,
  isFacilityCategory,
} from '~/types/facility'

describe('FacilityCategory type', () => {
  it('park, school, market 카테고리 포함', () => {
    const park: FacilityCategory = 'park'
    const school: FacilityCategory = 'school'
    const market: FacilityCategory = 'market'
    expect(park).toBe('park')
    expect(school).toBe('school')
    expect(market).toBe('market')
  })

  it('childcare 카테고리 포함', () => {
    const childcare: FacilityCategory = 'childcare'
    expect(childcare).toBe('childcare')
  })

  it('kiosk 카테고리 미포함 (CATEGORY_META에 없음)', () => {
    expect('kiosk' in CATEGORY_META).toBe(false)
  })

  it('ev-charger 카테고리 포함', () => {
    const evCharger: FacilityCategory = 'ev-charger'
    expect(evCharger).toBe('ev-charger')
  })

  it('sports 카테고리 포함', () => {
    const sports: FacilityCategory = 'sports'
    expect(sports).toBe('sports')
  })
})

describe('CATEGORY_GROUPS', () => {
  const allCategories = CATEGORY_GROUPS.flatMap(g => g.categories)

  it('정확히 4개 그룹', () => {
    expect(CATEGORY_GROUPS).toHaveLength(4)
  })

  it("'생활/편의' 그룹은 ['park', 'parking', 'ev-charger', 'toilet'] 순서로 포함", () => {
    const group = CATEGORY_GROUPS.find(g => g.title === '생활/편의')
    expect(group).toBeDefined()
    expect(group!.categories).toEqual(['park', 'market', 'parking', 'ev-charger', 'toilet'])
  })

  it("'교육/육아' 그룹은 ['school', 'library', 'childcare'] 순서로 포함", () => {
    const group = CATEGORY_GROUPS.find(g => g.title === '교육/육아')
    expect(group).toBeDefined()
    expect(group!.categories).toEqual(['school', 'childcare', 'library'])
  })

  it("'건강/안전' 그룹은 ['hospital', 'pharmacy', 'aed', 'sports'] 순서로 포함", () => {
    const group = CATEGORY_GROUPS.find(g => g.title === '건강/안전')
    expect(group).toBeDefined()
    expect(group!.categories).toEqual(['hospital', 'pharmacy', 'sports', 'aed'])
  })

  it("'환경/생활' 그룹은 ['clothes', 'trash', 'market'] 순서로 포함", () => {
    const group = CATEGORY_GROUPS.find(g => g.title === '환경/생활')
    expect(group).toBeDefined()
    expect(group!.categories).toEqual(['clothes', 'trash'])
  })

  it('wifi 미포함', () => {
    expect(allCategories).not.toContain('wifi')
  })

  it('kiosk 미포함', () => {
    expect(allCategories).not.toContain('kiosk')
  })

  it('각 그룹은 title과 categories 배열을 가짐', () => {
    CATEGORY_GROUPS.forEach(group => {
      expect(typeof group.title).toBe('string')
      expect(Array.isArray(group.categories)).toBe(true)
    })
  })
})

describe('CATEGORY_META', () => {
  it('park 키 존재', () => {
    expect(CATEGORY_META).toHaveProperty('park')
  })

  it('school 키 존재', () => {
    expect(CATEGORY_META).toHaveProperty('school')
  })

  it('market 키 존재', () => {
    expect(CATEGORY_META).toHaveProperty('market')
  })

  it('kiosk 키 미존재', () => {
    expect(CATEGORY_META).not.toHaveProperty('kiosk')
  })

  it('childcare 키 존재, label=어린이집, color=pink', () => {
    expect(CATEGORY_META).toHaveProperty('childcare')
    expect(CATEGORY_META.childcare.label).toBe('어린이집')
    expect(CATEGORY_META.childcare.color).toBe('pink')
  })

  it('ev-charger 키 존재, label=전기차 충전소, color=teal', () => {
    expect(CATEGORY_META).toHaveProperty('ev-charger')
    expect(CATEGORY_META['ev-charger'].label).toBe('전기차 충전소')
    expect(CATEGORY_META['ev-charger'].color).toBe('teal')
  })

  it('sports 키 존재, label=체육시설, color=cyan', () => {
    expect(CATEGORY_META).toHaveProperty('sports')
    expect(CATEGORY_META.sports.label).toBe('체육시설')
    expect(CATEGORY_META.sports.color).toBe('cyan')
  })
})

describe('FACILITY_CATEGORIES (runtime single source)', () => {
  it('15개 시설 카테고리를 모두 포함한다', () => {
    expect(FACILITY_CATEGORIES).toHaveLength(15)
  })

  it('CATEGORY_META 의 키 집합과 정확히 일치한다', () => {
    const metaKeys = Object.keys(CATEGORY_META).sort()
    const arrSorted = [...FACILITY_CATEGORIES].sort()
    expect(arrSorted).toEqual(metaKeys)
  })

  it('search redirect 대상 15개 카테고리 (childcare, ev-charger, sports, aed 포함) 모두 isFacilityCategory 를 통과한다', () => {
    const requiredForSearchRedirect = [
      'toilet',
      'trash',
      'wifi',
      'clothes',
      'parking',
      'aed',
      'library',
      'hospital',
      'pharmacy',
      'park',
      'school',
      'market',
      'childcare',
      'ev-charger',
      'sports',
    ]
    for (const cat of requiredForSearchRedirect) {
      expect(isFacilityCategory(cat)).toBe(true)
    }
  })

  it('존재하지 않는 카테고리는 isFacilityCategory 에서 false', () => {
    expect(isFacilityCategory('kiosk')).toBe(false)
    expect(isFacilityCategory('realestate')).toBe(false)
    expect(isFacilityCategory('')).toBe(false)
  })
})
