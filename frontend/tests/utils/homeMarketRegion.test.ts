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

  it('부동산 구 단위 목록으로 정규화한다 — 부천시 구는 유지, 예전 시 단위 저장값(bucheon)은 기존 규칙대로 전국으로 떨어진다', () => {
    expect(normalizeMarketRegion({ city: 'gyeonggi', district: 'bucheon-sosa' }))
      .toEqual({ city: 'gyeonggi', district: 'bucheon-sosa' })
    expect(normalizeMarketRegion({ city: '경기', district: '화성시 동탄구' }))
      .toEqual({ city: 'gyeonggi', district: 'hwaseong-dongtan' })
    expect(normalizeMarketRegion({ city: 'gyeonggi', district: 'bucheon' }))
      .toEqual({ city: null, district: null })
  })
})
