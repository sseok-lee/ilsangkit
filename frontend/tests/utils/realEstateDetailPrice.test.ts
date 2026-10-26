import { describe, expect, it } from 'vitest'
import { resolveDefaultLatestDeal, resolveHeroBasis } from '~/utils/realEstateDetailPrice'
import type { DetailOverview, LatestAnyDeal, PriceBasis } from '~/types/housingRedesign'

function deal(amount: number, date = '2026-10-19'): LatestAnyDeal {
  return { id: amount, date, amount, floor: 10, direct: false }
}

function basis(representative: number | null, latestAny: LatestAnyDeal | null = null): PriceBasis {
  return { representative, sampleCount: 5, changeRate: null, latestAny, max12m: null, yearAgo: null }
}

function overview(partial: Record<string, unknown>): DetailOverview {
  return {
    defaultAreaGroup: '84',
    basisMode: 'sale',
    areaGroups: [
      { key: '84', label: '84', pyeong: 25, saleCount36m: 10, jeonseCount36m: 4 },
      { key: '59', label: '59', pyeong: 18, saleCount36m: 3, jeonseCount36m: 2 },
    ],
    saleBasis: { '84': basis(94000, deal(91000)), '59': basis(70000, deal(71000)) },
    jeonseBasis: { '84': basis(50000, deal(48000, '2026-09-02')) },
    ...partial,
  } as unknown as DetailOverview
}

describe('resolveDefaultLatestDeal', () => {
  it('매매 모드는 기본 그룹의 최근 매매 1건', () => {
    expect(resolveDefaultLatestDeal(overview({}))).toEqual({ amount: 91000, date: '2026-10-19', areaLabel: '84', mode: 'sale' })
  })

  it('전세 모드는 기본 그룹의 최근 전세 1건', () => {
    expect(resolveDefaultLatestDeal(overview({ basisMode: 'jeonse' }))).toEqual({ amount: 48000, date: '2026-09-02', areaLabel: '84', mode: 'jeonse' })
  })

  it('중간값이 없어도 최근 거래가 있으면 쓴다', () => {
    expect(resolveDefaultLatestDeal(overview({ saleBasis: { '84': basis(null, deal(30500)) } }))?.amount).toBe(30500)
  })

  it('최근 거래·기본 그룹·라벨이 없으면 null', () => {
    expect(resolveDefaultLatestDeal(overview({ saleBasis: { '84': basis(94000) } }))).toBeNull()
    expect(resolveDefaultLatestDeal(overview({ defaultAreaGroup: null }))).toBeNull()
    expect(resolveDefaultLatestDeal(overview({ areaGroups: [] }))).toBeNull()
  })

  it('히어로 기본 상태(selectedArea=null)와 같은 그룹·기준을 쓴다', () => {
    const o = overview({})
    const hero = resolveHeroBasis(o, null)
    expect(hero.groupKey).toBe('84')
    expect(hero.basis?.latestAny?.amount).toBe(resolveDefaultLatestDeal(o)?.amount)
  })
})

describe('resolveHeroBasis', () => {
  it('전월세 URL 은 같은 그룹 최근 매매 1건을 함께 돌려준다', () => {
    const hero = resolveHeroBasis(overview({ basisMode: 'jeonse' }), null)
    expect(hero.basis?.latestAny?.amount).toBe(48000)
    expect(hero.saleLatest?.amount).toBe(91000)
  })

  it('매매 URL 은 saleLatest 가 없다', () => {
    expect(resolveHeroBasis(overview({}), null).saleLatest).toBeNull()
  })
})
