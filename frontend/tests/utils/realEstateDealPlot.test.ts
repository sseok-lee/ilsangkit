import { describe, expect, it } from 'vitest'
import { DEAL_PLOT_PADDING, groupDealPoints, projectDealPoints, projectMonthlyDealTrend } from '~/utils/realEstateDealPlot'
import type { DealPoint } from '~/types/housingRedesign'

const base = {
  date: '2026-09-12',
  amount: 120,
  area: '84.90',
  floor: null,
  deposit: 0,
}

describe('realEstateDealPlot', () => {
  it('중복 좌표의 거래도 개별 집계하여 홀수·짝수 월 중앙값을 계산한다', () => {
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

  it('한 날짜만 조회해도 거래 점과 중앙값의 좌표가 일치한다', () => {
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
})
