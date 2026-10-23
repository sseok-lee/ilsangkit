import { describe, expect, it } from 'vitest'
import { resolveDefaultRepresentative, resolveHeroBasis } from '~/utils/realEstateDetailPrice'
import type { DetailOverview, PriceBasis } from '~/types/housingRedesign'

function basis(representative: number | null): PriceBasis {
  return { representative, sampleCount: 5, changeRate: null, latest: null, latestAny: null, max12m: null, excluded: [] } as unknown as PriceBasis
}

function overview(partial: Record<string, unknown>): DetailOverview {
  return {
    defaultAreaGroup: '84',
    basisMode: 'sale',
    areaGroups: [
      { key: '84', label: '84', pyeong: 25, saleCount36m: 10, jeonseCount36m: 4 },
      { key: '59', label: '59', pyeong: 18, saleCount36m: 3, jeonseCount36m: 2 },
    ],
    saleBasis: { '84': basis(94000), '59': basis(70000) },
    jeonseBasis: { '84': basis(50000) },
    ...partial,
  } as unknown as DetailOverview
}

describe('resolveDefaultRepresentative', () => {
  it('매매 모드는 기본 그룹의 매매 대표 시세', () => {
    expect(resolveDefaultRepresentative(overview({}))).toEqual({ amount: 94000, areaLabel: '84', mode: 'sale' })
  })

  it('전세 모드는 전세 대표 시세', () => {
    expect(resolveDefaultRepresentative(overview({ basisMode: 'jeonse' }))).toEqual({ amount: 50000, areaLabel: '84', mode: 'jeonse' })
  })

  it('대표 시세·기본 그룹·라벨이 없으면 null', () => {
    expect(resolveDefaultRepresentative(overview({ saleBasis: { '84': basis(null) } }))).toBeNull()
    expect(resolveDefaultRepresentative(overview({ defaultAreaGroup: null }))).toBeNull()
    expect(resolveDefaultRepresentative(overview({ areaGroups: [] }))).toBeNull()
  })

  it('히어로 기본 상태(selectedArea=null)와 같은 그룹·기준을 쓴다', () => {
    const o = overview({})
    const hero = resolveHeroBasis(o, null)
    expect(hero.groupKey).toBe('84')
    expect(hero.basis?.representative).toBe(resolveDefaultRepresentative(o)?.amount)
  })
})
