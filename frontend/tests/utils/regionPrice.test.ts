import { describe, expect, it } from 'vitest'
import { formatRegionAvgPrice } from '../../utils/regionPrice'

describe('formatRegionAvgPrice', () => {
  it('formats zero as "데이터 없음"', () => {
    expect(formatRegionAvgPrice(0)).toBe('데이터 없음')
  })

  it('formats null as "데이터 없음"', () => {
    expect(formatRegionAvgPrice(null)).toBe('데이터 없음')
  })

  it('formats a plain integer under 1억', () => {
    expect(formatRegionAvgPrice(5000)).toBe('5,000만원')
  })

  it('formats exactly at the 억 boundary (no remainder)', () => {
    expect(formatRegionAvgPrice(10000)).toBe('1억')
  })

  it('formats 억 + 만 combination for an integer input', () => {
    // 15억 3,000만원 (153000 → eok=15, remainder=3000)
    expect(formatRegionAvgPrice(153000)).toBe('15억 3,000만원')
  })

  it('preserves decimal remainder without rounding', () => {
    // 지역 허브 평균은 소수일 수 있음 (no-round 정책).
    // 30500.7 → eok=3, remainder=30500.7%10000=500.7
    // 500.7.toLocaleString() = '500.7' (no rounding)
    // 결과: '3억 500.7만원'
    expect(formatRegionAvgPrice(30500.7)).toBe('3억 500.7만원')
  })
})
