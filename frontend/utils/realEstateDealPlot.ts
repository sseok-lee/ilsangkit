import { medianOf } from '~/utils/realEstatePriceSummary'
import type { DateWindow, DealPoint } from '~/types/housingRedesign'

export interface DealPointGroup {
  date: string
  amount: number
  points: DealPoint[]
}

export interface ProjectedDealPoint extends DealPointGroup {
  x: number
  y: number
}

export interface MonthlyDealTrend {
  month: string
  amount: number | null
  points: DealPoint[]
  x: number
  y: number | null
}

export const DEAL_PLOT_PADDING = {
  top: 16,
  right: 16,
  bottom: 28,
  left: 44,
} as const

function dateMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime()
}

export function groupDealPoints(points: DealPoint[]): DealPointGroup[] {
  const groups = new Map<string, DealPointGroup>()
  for (const point of points) {
    const key = `${point.date}:${point.amount}`
    const group = groups.get(key) ?? { date: point.date, amount: point.amount, points: [] }
    group.points.push(point)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function projectDealPoints(
  points: DealPoint[],
  window: DateWindow,
  width: number,
  height: number
): ProjectedDealPoint[] {
  const groups = groupDealPoints(points)
  if (groups.length === 0) return []

  const project = createProjection(points, window, width, height)
  return groups.map(group => ({ ...group, ...project(dateMs(group.date), group.amount) }))
}

function createProjection(points: DealPoint[], window: DateWindow, width: number, height: number) {

  const plotWidth = Math.max(1, width - DEAL_PLOT_PADDING.left - DEAL_PLOT_PADDING.right)
  const plotHeight = Math.max(1, height - DEAL_PLOT_PADDING.top - DEAL_PLOT_PADDING.bottom)
  const from = dateMs(window.from)
  const to = dateMs(window.to)
  const day = 24 * 60 * 60 * 1000
  const timeSpan = to === from ? day : to - from
  const timeStart = to === from ? from - day / 2 : from
  const amounts = points.map(point => point.amount)
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)
  const amountPadding = minAmount === maxAmount
    ? Math.max(1, Math.abs(minAmount) * 0.05)
    : (maxAmount - minAmount) * 0.1
  const amountMin = minAmount - amountPadding
  const amountMax = maxAmount + amountPadding
  const amountSpan = Math.max(1, amountMax - amountMin)

  return (date: number, amount: number) => ({
    x: DEAL_PLOT_PADDING.left + ((date - timeStart) / timeSpan) * plotWidth,
    y: DEAL_PLOT_PADDING.top + (1 - ((amount - amountMin) / amountSpan)) * plotHeight,
  })
}

/** Keep empty months so renderers never bridge a gap in reported transactions. */
export function projectMonthlyDealTrend(
  points: DealPoint[], window: DateWindow, width: number, height: number
): MonthlyDealTrend[] {
  const from = dateMs(window.from)
  const to = dateMs(window.to)
  const inRange = points.filter(point => point.date >= window.from && point.date <= window.to)
  if (!inRange.length) return []
  const project = createProjection(inRange, window, width, height)
  const byMonth = new Map<string, DealPoint[]>()
  for (const point of inRange) {
    const month = point.date.slice(0, 7)
    const group = byMonth.get(month) ?? []
    group.push(point)
    byMonth.set(month, group)
  }
  const result: MonthlyDealTrend[] = []
  let start = new Date(`${window.from.slice(0, 7)}-01T00:00:00Z`)
  while (start.getTime() <= to) {
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    const month = start.toISOString().slice(0, 7)
    const group = byMonth.get(month) ?? []
    // 월 집계는 그 달 모든 거래(직거래 포함)의 중간값.
    const amount = medianOf(group.map(point => point.amount))
    // Monthly aggregates sit at the midpoint of the visible part of that month.
    const center = (Math.max(from, start.getTime()) + Math.min(to, next.getTime() - 86400000)) / 2
    const position = project(center, amount ?? 0)
    result.push({ month, amount, points: group, x: position.x, y: amount === null ? null : position.y })
    start = next
  }
  return result
}

/** 월 선택에 붙일 상태 문구. 중간값이 있으면 null, 거래가 없는 달은 '거래 없음'. */
export function monthlyTrendStatus(month: Pick<MonthlyDealTrend, 'amount' | 'points'>): string | null {
  if (month.amount !== null) return null
  return '거래 없음'
}
