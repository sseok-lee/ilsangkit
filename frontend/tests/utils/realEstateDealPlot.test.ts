import { describe, expect, it } from 'vitest'
import { DEAL_PLOT_PADDING, groupDealPoints, monthlyTrendStatus, projectDealPoints, projectMonthlyDealTrend } from '~/utils/realEstateDealPlot'
import type { DealPoint } from '~/types/housingRedesign'

const base = {
  flag: 'normal' as const,
  date: '2026-09-12',
  amount: 120,
  area: '84.90',
  floor: null,
  deposit: 0,
}

describe('realEstateDealPlot', () => {
  it('월별 중간값의 소수를 유지하고 유효한 0과 빈 달을 구분한다', () => {
    const points: DealPoint[] = [
      { ...base, id: 1, date: '2026-08-01', amount: 100 },
      { ...base, id: 2, date: '2026-08-02', amount: 101 },
      { ...base, id: 3, date: '2026-08-03', amount: 101 },
      { ...base, id: 4, date: '2026-10-01', amount: 0 },
    ]
    const trend = projectMonthlyDealTrend(
      points, { from: '2026-08-01', to: '2026-10-31' }, 400, 288
    )
    expect(trend[0].amount).toBe(101)
    expect(trend[1].amount).toBeNull()
    expect(trend[1].y).toBeNull()
    expect(trend[2].amount).toBe(0)
    expect(Number.isFinite(trend[2].y)).toBe(true)
    expect(points.map(point => point.amount)).toEqual([100, 101, 101, 0])
  })

  it('중복 좌표의 거래도 개별 집계하여 월별 중간값을 계산한다', () => {
    const points = [
      { ...base, id: 1, date: '2026-08-01', amount: 100 },
      { ...base, id: 2, date: '2026-08-01', amount: 100 },
      { ...base, id: 3, date: '2026-08-20', amount: 400 },
      { ...base, id: 4, date: '2026-09-01', amount: 200 },
      { ...base, id: 5, date: '2026-09-20', amount: 400 },
    ]
    const trend = projectMonthlyDealTrend(points, { from: '2026-08-01', to: '2026-09-30' }, 400, 288)
    expect(trend.map(p => [p.month, p.amount, p.points.length])).toEqual([
      ['2026-08', 100, 3], ['2026-09', 300, 2],
    ])
    expect(points[0].id).toBe(1)
  })

  it('연도 경계와 빈 달을 유지하고 조회기간 밖의 거래는 집계하지 않는다', () => {
    const points = [
      { ...base, id: 1, date: '2025-12-30', amount: 100 },
      { ...base, id: 2, date: '2026-02-02', amount: 300 },
      { ...base, id: 3, date: '2026-02-03', amount: 900 },
    ]
    const trend = projectMonthlyDealTrend(points, { from: '2025-12-29', to: '2026-02-02' }, 400, 288)
    expect(trend.map(p => [p.month, p.amount])).toEqual([['2025-12', 100], ['2026-01', null], ['2026-02', 300]])
    expect(trend[1].y).toBeNull()
    for (const point of trend) {
      expect(point.x).toBeGreaterThanOrEqual(DEAL_PLOT_PADDING.left)
      expect(point.x).toBeLessThanOrEqual(400 - DEAL_PLOT_PADDING.right)
    }
  })

  it('한 날짜만 조회해도 거래 점과 월별 중간값의 좌표가 일치한다', () => {
    const points = [{ ...base, id: 1 }]
    const window = { from: base.date, to: base.date }
    const [trend] = projectMonthlyDealTrend(points, window, 320, 288)
    const [point] = projectDealPoints(points, window, 320, 288)
    expect(trend.x).toBe(point.x)
    expect(trend.y).toBe(point.y)
    expect(trend.amount).toBe(120)
  })

  it('겹친 점에서 두 거래를 모두 선택할 수 있다', () => {
    const groups = groupDealPoints([{ ...base, id: 1 }, { ...base, id: 2 }])
    expect(groups).toHaveLength(1)
    expect(groups[0].points.map(p => p.id)).toEqual([1, 2])
  })

  it('같은 날짜라도 금액이 다르면 별도 점으로 유지한다', () => {
    const groups = groupDealPoints([
      { ...base, id: 1, amount: 120 },
      { ...base, id: 2, amount: 150 },
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.points[0].id)).toEqual([1, 2])
  })

  it('실제 날짜와 금액으로 좌표를 투영한다', () => {
    const points: DealPoint[] = [
      { ...base, id: 1, date: '2026-01-01', amount: 100 },
      { ...base, id: 2, date: '2026-07-01', amount: 200 },
    ]

    const projected = projectDealPoints(points, { from: '2026-01-01', to: '2026-07-01' }, 300, 200)

    expect(projected[0].x).toBe(DEAL_PLOT_PADDING.left)
    expect(projected[1].x).toBe(300 - DEAL_PLOT_PADDING.right)
    expect(projected[0].y).toBeGreaterThan(projected[1].y)
    expect(projected.flatMap(point => point.points.map(item => item.id))).toEqual([1, 2])
  })

  it('날짜나 금액 범위가 한 값이어도 유효한 좌표를 만든다', () => {
    const projected = projectDealPoints(
      [{ ...base, id: 1 }, { ...base, id: 2 }],
      { from: '2026-09-12', to: '2026-09-12' },
      320,
      180
    )

    expect(projected).toHaveLength(1)
    expect(Number.isFinite(projected[0].x)).toBe(true)
    expect(Number.isFinite(projected[0].y)).toBe(true)
    expect(projected[0].points.map(point => point.id)).toEqual([1, 2])
  })

  it('monthly amount is median of normal points', () => {
    const o = (id: number, date: string, amount: number, flag: DealPoint['flag'] = 'normal'): DealPoint =>
      ({ ...base, id, date, amount, area: '84.97', flag })
    const points = [
      o(1, '2026-10-19', 91000), o(2, '2026-10-18', 88000), o(3, '2026-10-17', 94000),
      o(4, '2026-10-17', 95000), o(5, '2026-10-14', 53000, 'outlier'), o(6, '2026-10-14', 97000),
      o(7, '2026-10-12', 100000), o(8, '2026-10-04', 91000), o(9, '2026-10-02', 103000),
    ]
    const trend = projectMonthlyDealTrend(points, { from: '2026-10-01', to: '2026-10-31' }, 400, 288)
    expect(trend[0].amount).toBe(94500)
    expect(trend[0].points).toHaveLength(9)
  })

  it('month with only excluded points has null amount', () => {
    const points: DealPoint[] = [
      { ...base, id: 1, date: '2026-09-02', amount: 50000, flag: 'outlier' },
      { ...base, id: 2, date: '2026-09-03', amount: 60000, flag: 'direct' },
      { ...base, id: 3, date: '2026-10-03', amount: 70000 },
    ]
    const trend = projectMonthlyDealTrend(points, { from: '2026-09-01', to: '2026-10-31' }, 400, 288)
    expect(trend[0].amount).toBeNull()
    expect(trend[0].y).toBeNull()
    expect(trend[0].points).toHaveLength(2)
    expect(trend[1].amount).toBe(70000)
  })

  it('제외 거래만 있는 달은 거래 없음이 아니라 정상 거래 없음 · 제외 N건이다', () => {
    const points: DealPoint[] = [
      { ...base, id: 1, date: '2026-08-01', amount: 100 },
      { ...base, id: 2, date: '2026-09-03', amount: 50, flag: 'direct' },
      { ...base, id: 3, date: '2026-09-04', amount: 300, flag: 'outlier' },
    ]
    const trend = projectMonthlyDealTrend(points, { from: '2026-08-01', to: '2026-10-31' }, 400, 288)
    expect(trend.map(monthlyTrendStatus)).toEqual([null, '정상 거래 없음 · 제외 2건', '거래 없음'])
  })
})
