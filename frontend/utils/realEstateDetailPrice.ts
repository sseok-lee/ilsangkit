import type { DetailOverview, PriceBasis } from '~/types/housingRedesign'

export interface HeroBasis {
  groupKey: string | null
  basis: PriceBasis | null
  /** 전월세 URL 에서 같은 그룹 매매 대표 시세(있을 때만) */
  saleRepresentative: number | null
}

export interface DefaultRepresentative {
  /** 만원 단위 */
  amount: number
  areaLabel: string
  mode: 'sale' | 'jeonse'
}

/**
 * 어떤 면적 그룹·어떤 기준(매매/전세)을 보여줄지 한 곳에서 정한다.
 * 히어로(기본·선택 상태), meta description, JSON-LD 가 모두 이 함수를 거친다.
 * selectedArea 가 없거나 모르는 키면 overview.defaultAreaGroup 으로 돌아간다.
 */
export function resolveHeroBasis(overview: DetailOverview, selectedArea: string | null): HeroBasis {
  const keys = new Set((overview.areaGroups ?? []).map(group => group.key))
  const groupKey = selectedArea && keys.has(selectedArea) ? selectedArea : overview.defaultAreaGroup
  if (!groupKey) return { groupKey: null, basis: null, saleRepresentative: null }
  const source = overview.basisMode === 'jeonse' ? overview.jeonseBasis : overview.saleBasis
  const saleRepresentative = overview.basisMode === 'jeonse'
    ? overview.saleBasis?.[groupKey]?.representative ?? null
    : null
  return { groupKey, basis: source?.[groupKey] ?? null, saleRepresentative }
}

/**
 * 기본 면적 그룹의 대표 시세. meta·JSON-LD 는 사용자가 고른 칩이 아닌 이 값만 쓴다(SSR 색인 안정).
 * 대표 시세·기본 그룹·그룹 라벨 중 하나라도 없으면 null.
 */
export function resolveDefaultRepresentative(overview: DetailOverview): DefaultRepresentative | null {
  const { groupKey, basis } = resolveHeroBasis(overview, null)
  if (!groupKey || basis?.representative == null) return null
  const label = (overview.areaGroups ?? []).find(group => group.key === groupKey)?.label
  if (!label) return null
  return {
    amount: basis.representative,
    areaLabel: label,
    mode: overview.basisMode === 'jeonse' ? 'jeonse' : 'sale',
  }
}
