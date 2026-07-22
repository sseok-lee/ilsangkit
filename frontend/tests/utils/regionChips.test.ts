import { describe, it, expect } from 'vitest'
import { SIDO_CHIPS, resolveCityParam } from '~/utils/regionChips'

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
