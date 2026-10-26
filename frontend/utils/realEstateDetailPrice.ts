import type { DetailOverview, LatestAnyDeal, PriceBasis } from '~/types/housingRedesign'

export interface HeroBasis {
  groupKey: string | null
  basis: PriceBasis | null
  /** 전월세 URL 에서 같은 그룹 최근 매매 1건(있을 때만) */
  saleLatest: LatestAnyDeal | null
}

export interface DefaultLatestDeal {
  /** 만원 단위 */
  amount: number
  /** YYYY-MM-DD */
  date: string
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
  if (!groupKey) return { groupKey: null, basis: null, saleLatest: null }
  const source = overview.basisMode === 'jeonse' ? overview.jeonseBasis : overview.saleBasis
  const saleLatest = overview.basisMode === 'jeonse'
    ? overview.saleBasis?.[groupKey]?.latestAny ?? null
    : null
  return { groupKey, basis: source?.[groupKey] ?? null, saleLatest }
}

/**
 * 기본 면적 그룹의 최근 거래 1건(히어로 주 숫자와 같은 값). meta·JSON-LD 는 사용자가 고른 칩이 아닌
 * 이 값만 쓴다(SSR 색인 안정). 최근 거래·기본 그룹·그룹 라벨 중 하나라도 없으면 null.
 */
export function resolveDefaultLatestDeal(overview: DetailOverview): DefaultLatestDeal | null {
  const { groupKey, basis } = resolveHeroBasis(overview, null)
  const latest = basis?.latestAny
  if (!groupKey || !latest) return null
  const label = (overview.areaGroups ?? []).find(group => group.key === groupKey)?.label
  if (!label) return null
  return {
    amount: latest.amount,
    date: latest.date,
    areaLabel: label,
    mode: overview.basisMode === 'jeonse' ? 'jeonse' : 'sale',
  }
}
