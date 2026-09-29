import type { DealKind, DealSnapshot, LatestDeals } from '~/types/realEstateExploration'

const DEAL_KIND_PRIORITY: Record<DealKind, number> = {
  sale: 0,
  jeonse: 1,
  wolse: 2,
}

function compareDeals(a: DealSnapshot, b: DealSnapshot): number {
  if (a.dealYear !== b.dealYear) return a.dealYear - b.dealYear
  if (a.dealMonth !== b.dealMonth) return a.dealMonth - b.dealMonth

  const aHasDay = a.dealDay != null
  const bHasDay = b.dealDay != null
  if (aHasDay !== bHasDay) return aHasDay ? 1 : -1
  if (aHasDay && bHasDay && a.dealDay !== b.dealDay) {
    return (a.dealDay as number) - (b.dealDay as number)
  }

  return DEAL_KIND_PRIORITY[b.kind] - DEAL_KIND_PRIORITY[a.kind]
}

export function selectRepresentativeDeal(deals: LatestDeals): DealSnapshot | null {
  const candidates = [deals.sale, deals.jeonse, deals.wolse].filter(
    (deal): deal is DealSnapshot => deal != null,
  )
  if (candidates.length === 0) return null

  return candidates.reduce((selected, deal) =>
    compareDeals(deal, selected) > 0 ? deal : selected
  )
}

export function formatDealDate(deal: DealSnapshot): string {
  const year = String(deal.dealYear)
  const month = String(deal.dealMonth).padStart(2, '0')
  if (deal.dealDay == null) return `${year}.${month} 계약`
  return `${year}.${month}.${String(deal.dealDay).padStart(2, '0')} 계약`
}
