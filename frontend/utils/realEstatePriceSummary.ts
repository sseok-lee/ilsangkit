import type { DealPoint } from '~/types/housingRedesign'

export interface PointSummary {
  max: number | null
  min: number | null
  median: number | null
  count: number
}

export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 대표 시세와 같은 기준: 직거래 포함 모든 거래를 최고·최저·중간값·건수에 반영한다. */
export function summarizePoints(points: DealPoint[]): PointSummary {
  const amounts = points.map(point => point.amount)
  if (amounts.length === 0) return { max: null, min: null, median: null, count: 0 }
  return {
    max: Math.max(...amounts),
    min: Math.min(...amounts),
    median: medianOf(amounts),
    count: amounts.length,
  }
}
