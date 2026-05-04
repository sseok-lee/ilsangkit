import type { TransactionStats } from '~/types/realEstate'

export type RealEstateSummaryTone = 'green' | 'blue' | 'amber' | 'slate'

export interface RealEstateSummaryBadge {
  label: string
  tone: RealEstateSummaryTone
}

export function getPeriodTradeLabel(months: number | null): string {
  if (months === 6) return '최근 6개월 거래'
  if (months === 12) return '최근 1년 거래'
  if (months === 36) return '최근 3년 거래'
  if (months === 60) return '최근 5년 거래'
  return '전체 기간 거래'
}

export function sumTransactionCount(stats: TransactionStats[]): number {
  return stats.reduce((sum, item) => sum + item.count, 0)
}

export function getPriceExtremes(stats: TransactionStats[]): { maxPrice: number | null; minPrice: number | null } {
  const maxPrices = stats.map(item => item.maxPrice).filter(price => price > 0)
  const minPrices = stats.map(item => item.minPrice).filter(price => price > 0)

  return {
    maxPrice: maxPrices.length > 0 ? Math.max(...maxPrices) : null,
    minPrice: minPrices.length > 0 ? Math.min(...minPrices) : null,
  }
}

export function getTradeActivityBadge(count: number): RealEstateSummaryBadge {
  if (count >= 10) return { label: '거래 활발', tone: 'green' }
  if (count >= 3) return { label: '거래 확인', tone: 'blue' }
  if (count > 0) return { label: '거래 적음', tone: 'amber' }
  return { label: '거래 없음', tone: 'slate' }
}

export function getRecencyBadge(
  year: number | null | undefined,
  month: number | null | undefined,
  now = new Date(),
): RealEstateSummaryBadge | null {
  if (!year || !month) return null

  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth()
  const tradeMonthIndex = year * 12 + (month - 1)
  const diff = currentMonthIndex - tradeMonthIndex

  if (diff <= 3) return { label: '최근 거래 있음', tone: 'green' }
  if (diff <= 12) return { label: '1년 내 거래', tone: 'blue' }
  return { label: '최근 거래 오래됨', tone: 'amber' }
}

export function getPriceRangeBadge(
  maxPrice: number | null,
  minPrice: number | null,
  averagePrice: number | null | undefined,
): RealEstateSummaryBadge | null {
  if (!maxPrice || !minPrice || !averagePrice || averagePrice <= 0 || maxPrice <= minPrice) return null

  const rangeRate = (maxPrice - minPrice) / averagePrice
  if (rangeRate >= 0.25) return { label: '가격 범위 큼', tone: 'amber' }
  if (rangeRate >= 0.1) return { label: '가격 범위 보통', tone: 'blue' }
  return { label: '가격 범위 작음', tone: 'green' }
}

export function normalizeFacilitySummary(summary: string | null | undefined): string | null {
  if (!summary) return null
  return summary
    .replace(/\s*등\s*생활시설\s*$/, '')
    .replace(/,/g, ' ·')
    .trim() || null
}
