import { describe, expect, it } from 'vitest'
import { summarizePoints } from '~/utils/realEstatePriceSummary'
import type { DealPoint } from '~/types/housingRedesign'

const p = (id: number, amount: number, flag: DealPoint['flag'] = 'normal'): DealPoint =>
  ({ id, date: '2026-10-01', amount, area: '84.97', floor: 5, deposit: 0, flag })

describe('summarizePoints', () => {
  it('직거래·낮은 거래를 포함한 모든 거래를 최고·최저·중간값·건수에 반영한다', () => {
    const r = summarizePoints([p(1, 91000), p(2, 53000), p(3, 97000), p(4, 120000, 'direct'), p(5, 100000)])
    expect(r).toEqual({ max: 120000, min: 53000, median: 97000, count: 5 })
  })

  it('짝수 건은 가운데 두 값의 평균', () => {
    expect(summarizePoints([p(1, 90000), p(2, 100000)]).median).toBe(95000)
  })

  it('거래가 없으면 null 과 0건', () => {
    expect(summarizePoints([])).toEqual({ max: null, min: null, median: null, count: 0 })
  })
})
