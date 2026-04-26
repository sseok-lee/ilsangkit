import { describe, it, expect } from 'vitest'
import {
  getCurrentYearMonth,
  getCurrentYear,
  CITY_LINKS,
  POPULAR_REGIONS,
  CATEGORY_SEO_TITLE,
  CATEGORY_SEO_DESCRIPTION,
} from '~/utils/seoConstants'

describe('getCurrentYearMonth', () => {
  it('YYYY.MM 형식을 반환한다', () => {
    const result = getCurrentYearMonth()
    expect(result).toMatch(/^\d{4}\.\d{2}$/)
  })

  it('현재 연도를 포함한다', () => {
    const result = getCurrentYearMonth()
    const year = new Date().getFullYear().toString()
    expect(result.startsWith(year)).toBe(true)
  })

  it('월이 2자리로 패딩된다', () => {
    const result = getCurrentYearMonth()
    const parts = result.split('.')
    expect(parts[1].length).toBe(2)
  })
})

describe('getCurrentYear', () => {
  it('4자리 숫자를 반환한다', () => {
    const result = getCurrentYear()
    expect(result).toBeGreaterThanOrEqual(2020)
    expect(result).toBeLessThanOrEqual(2100)
    expect(String(result)).toMatch(/^\d{4}$/)
  })

  it('현재 연도와 일치한다', () => {
    expect(getCurrentYear()).toBe(new Date().getFullYear())
  })
})

describe('CITY_LINKS', () => {
  it('정확히 17개 항목을 가진다', () => {
    expect(CITY_LINKS).toHaveLength(17)
  })

  it('각 항목이 slug와 label 속성을 가진다', () => {
    CITY_LINKS.forEach(link => {
      expect(typeof link.slug).toBe('string')
      expect(link.slug.length).toBeGreaterThan(0)
      expect(typeof link.label).toBe('string')
      expect(link.label.length).toBeGreaterThan(0)
    })
  })

  it("{ slug: 'seoul', label: '서울' } 항목을 포함한다", () => {
    expect(CITY_LINKS).toContainEqual({ slug: 'seoul', label: '서울' })
  })

  it("경기, 부산, 제주 항목을 포함한다", () => {
    const slugs = CITY_LINKS.map(l => l.slug)
    expect(slugs).toContain('gyeonggi')
    expect(slugs).toContain('busan')
    expect(slugs).toContain('jeju')
  })
})

describe('POPULAR_REGIONS', () => {
  it('정확히 12개 항목을 가진다', () => {
    expect(POPULAR_REGIONS).toHaveLength(12)
  })

  it('각 항목이 citySlug, districtSlug, label 속성을 가진다', () => {
    POPULAR_REGIONS.forEach(region => {
      expect(typeof region.citySlug).toBe('string')
      expect(region.citySlug.length).toBeGreaterThan(0)
      expect(typeof region.districtSlug).toBe('string')
      expect(region.districtSlug.length).toBeGreaterThan(0)
      expect(typeof region.label).toBe('string')
      expect(region.label.length).toBeGreaterThan(0)
    })
  })

  it('강남구 항목을 포함한다', () => {
    const gangnam = POPULAR_REGIONS.find(r => r.label === '강남구')
    expect(gangnam).toBeDefined()
    expect(gangnam?.citySlug).toBe('seoul')
    expect(gangnam?.districtSlug).toBe('gangnam')
  })

  it('서울과 경기 지역을 포함한다', () => {
    const citySlugs = POPULAR_REGIONS.map(r => r.citySlug)
    expect(citySlugs).toContain('seoul')
    expect(citySlugs).toContain('gyeonggi')
  })
})

describe('CATEGORY_SEO_TITLE', () => {
  it('모든 15개 카테고리에 대한 항목을 가진다', () => {
    const expected = ['toilet','hospital','pharmacy','parking','wifi','aed',
      'library','clothes','trash','park','school','market','childcare','ev-charger','sports']
    expected.forEach(cat => {
      expect(CATEGORY_SEO_TITLE).toHaveProperty(cat)
    })
  })

  it('각 타이틀이 30자 이상 60자 이하다', () => {
    Object.values(CATEGORY_SEO_TITLE).forEach(title => {
      expect(title.length).toBeGreaterThanOrEqual(30)
      expect(title.length).toBeLessThanOrEqual(60)
    })
  })

  it('hospital 타이틀에 "병원"과 검색 의도 키워드를 포함한다', () => {
    expect(CATEGORY_SEO_TITLE['hospital']).toContain('병원')
    const hasIntent = ['진료과', '진료시간'].some(kw => CATEGORY_SEO_TITLE['hospital'].includes(kw))
    expect(hasIntent).toBe(true)
  })
})

describe('CATEGORY_SEO_DESCRIPTION', () => {
  it('모든 15개 카테고리에 대한 항목을 가진다', () => {
    const expected = ['toilet','hospital','pharmacy','parking','wifi','aed',
      'library','clothes','trash','park','school','market','childcare','ev-charger','sports']
    expected.forEach(cat => {
      expect(CATEGORY_SEO_DESCRIPTION).toHaveProperty(cat)
    })
  })

  it('각 디스크립션이 80자 이상 160자 이하다', () => {
    Object.values(CATEGORY_SEO_DESCRIPTION).forEach(desc => {
      expect(desc.length).toBeGreaterThanOrEqual(80)
      expect(desc.length).toBeLessThanOrEqual(160)
    })
  })

  it('hospital 디스크립션에 "병원"을 포함한다', () => {
    expect(CATEGORY_SEO_DESCRIPTION['hospital']).toContain('병원')
  })
})
