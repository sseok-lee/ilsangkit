import { describe, it, expect } from 'vitest'
import { SIDO_CHIPS, resolveCityParam, buildListFetch } from '~/utils/regionChips'

describe('SIDO_CHIPS', () => {
  it('16개이며 레거시 광주/전남 slug를 제외하고 전남광주를 포함한다', () => {
    const slugs = SIDO_CHIPS.map((c) => c.slug)
    expect(SIDO_CHIPS).toHaveLength(16)
    expect(slugs).not.toContain('gwangju')
    expect(slugs).not.toContain('jeonnam')
    expect(slugs).toContain('jeonnamgwangju')
    expect(SIDO_CHIPS.find((c) => c.slug === 'jeonnamgwangju')?.label).toBe('전남·광주')
  })
})

describe('resolveCityParam', () => {
  it('slug를 한글 city명으로 변환한다', () => {
    expect(resolveCityParam('seoul')).toBe('서울')
    expect(resolveCityParam('jeonnamgwangju')).toBe('전남광주통합특별시')
  })
  it('잘못된 slug/빈값은 undefined(fail-open)', () => {
    expect(resolveCityParam('bogus')).toBeUndefined()
    expect(resolveCityParam('')).toBeUndefined()
    expect(resolveCityParam(undefined)).toBeUndefined()
  })
})

describe('buildListFetch keyword', () => {
  it('시설: keyword 를 검색 API body 에 넣는다', () => {
    const { url, options } = buildListFetch('toilet', 'seoul', 1, '역삼')
    expect(url).toBe('/api/facilities/search')
    expect(options.body).toMatchObject({ category: 'toilet', city: '서울', keyword: '역삼' })
  })
  it('시설: keyword 없으면 body 에 keyword 키가 없다', () => {
    const { options } = buildListFetch('toilet', '', 1)
    expect(options.body).not.toHaveProperty('keyword')
  })
  it('trash: keyword 를 waste-schedules params 에 넣는다', () => {
    const { url, options } = buildListFetch('trash', 'seoul', 1, '삼성동')
    expect(url).toBe('/api/waste-schedules')
    expect(options.params).toMatchObject({ city: '서울', keyword: '삼성동' })
  })
})
