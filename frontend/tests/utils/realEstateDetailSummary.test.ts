import { describe, expect, it } from 'vitest'
import {
  getPeriodTradeLabel,
  getPriceExtremes,
  getPriceRangeBadge,
  getRecencyBadge,
  getTradeActivityBadge,
  normalizeFacilitySummary,
  sumTransactionCount,
} from '../../utils/realEstateDetailSummary'
import type { TransactionStats } from '../../types/realEstate'

const stats: TransactionStats[] = [
  { year: 2026, month: 1, avgPrice: 45000, maxPrice: 50000, minPrice: 43000, count: 4 },
  { year: 2026, month: 2, avgPrice: 49000, maxPrice: 56000, minPrice: 47000, count: 6 },
]

describe('realEstateDetailSummary', () => {
  it('labels the selected period for compact summary cards', () => {
    expect(getPeriodTradeLabel(null)).toBe('전체 기간 거래')
    expect(getPeriodTradeLabel(12)).toBe('최근 1년 거래')
    expect(getPeriodTradeLabel(36)).toBe('최근 3년 거래')
  })

  it('summarizes transaction count and price extremes from monthly stats', () => {
    expect(sumTransactionCount(stats)).toBe(10)
    expect(getPriceExtremes(stats)).toEqual({ maxPrice: 56000, minPrice: 43000 })
  })

  it('turns data thresholds into short badges', () => {
    expect(getTradeActivityBadge(10)).toEqual({ label: '거래 활발', tone: 'green' })
    expect(getTradeActivityBadge(3)).toEqual({ label: '거래 확인', tone: 'blue' })
    expect(getTradeActivityBadge(1)).toEqual({ label: '거래 적음', tone: 'amber' })
  })

  it('calculates recency without hardcoding the current date', () => {
    const now = new Date('2026-05-04T00:00:00+09:00')
    expect(getRecencyBadge(2026, 4, now)).toEqual({ label: '최근 거래 있음', tone: 'green' })
    expect(getRecencyBadge(2025, 8, now)).toEqual({ label: '1년 내 거래', tone: 'blue' })
    expect(getRecencyBadge(2024, 1, now)).toEqual({ label: '최근 거래 오래됨', tone: 'amber' })
  })

  it('keeps price range badges compact and data-driven', () => {
    expect(getPriceRangeBadge(56000, 43000, 49070)).toEqual({ label: '가격 범위 큼', tone: 'amber' })
    expect(getPriceRangeBadge(52000, 47000, 49070)).toEqual({ label: '가격 범위 보통', tone: 'blue' })
    expect(getPriceRangeBadge(50000, 49000, 49070)).toEqual({ label: '가격 범위 작음', tone: 'green' })
  })

  it('normalizes facility summary for a one-line hero stat', () => {
    expect(normalizeFacilitySummary('어린이집 3곳, 공원 2곳 등 생활시설')).toBe('어린이집 3곳 · 공원 2곳')
    expect(normalizeFacilitySummary(null)).toBeNull()
  })
})
