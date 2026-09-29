import { describe, expect, it } from 'vitest'
import { normalizeMarketRegion } from '~/utils/homeMarketRegion'

describe('normalizeMarketRegion', () => {
  it('잘못된 부모/자식 지역은 전국으로 정규화한다', () => {
    expect(normalizeMarketRegion({ city: null, district: 'gangnam' }))
      .toEqual({ city: null, district: null })
    expect(normalizeMarketRegion({ city: 'seoul', district: 'gangnam' }))
      .toEqual({ city: 'seoul', district: 'gangnam' })
    expect(normalizeMarketRegion({ city: 'unknown', district: 'unknown' }))
      .toEqual({ city: null, district: null })
  })

  it('한글 지역명과 잘못된 하위 지역을 slug 계층으로 정규화한다', () => {
    expect(normalizeMarketRegion({ city: '서울', district: '강남구' }))
      .toEqual({ city: 'seoul', district: 'gangnam' })
    expect(normalizeMarketRegion({ city: 'seoul', district: 'haeundae' }))
      .toEqual({ city: null, district: null })
    expect(normalizeMarketRegion({ city: 'seoul', district: null }))
      .toEqual({ city: 'seoul', district: null })
    expect(normalizeMarketRegion({ city: 'seoul' }))
      .toEqual({ city: 'seoul', district: null })
  })
})
