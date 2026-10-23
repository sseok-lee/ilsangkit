import { describe, expect, it } from 'vitest'
import { summarizeNormalPoints } from '~/utils/realEstatePriceSummary'
import type { DealPoint } from '~/types/housingRedesign'

const p = (id: number, amount: number, flag: DealPoint['flag'] = 'normal'): DealPoint =>
  ({ id, date: '2026-10-01', amount, area: '84.97', floor: 5, deposit: 0, flag })

describe('summarizeNormalPoints', () => {
  it('정상 거래만 최고·최저·중간값·건수에 반영한다', () => {
    const r = summarizeNormalPoints([p(1, 91000), p(2, 53000, 'outlier'), p(3, 97000), p(4, 120000, 'direct'), p(5, 100000)])
    expect(r).toEqual({ max: 100000, min: 91000, median: 97000, count: 3 })
  })

  it('짝수 건은 가운데 두 값의 평균', () => {
    expect(summarizeNormalPoints([p(1, 90000), p(2, 100000)]).median).toBe(95000)
  })

  it('정상 거래가 없으면 null 과 0건', () => {
    expect(summarizeNormalPoints([p(1, 1, 'outlier')])).toEqual({ max: null, min: null, median: null, count: 0 })
    expect(summarizeNormalPoints([])).toEqual({ max: null, min: null, median: null, count: 0 })
  })
})
