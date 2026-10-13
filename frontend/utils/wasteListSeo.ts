import type { RegionScheduleResponse } from '~/composables/useWasteSchedule'
import type { WasteListQuery } from '~/types/wasteList'

interface WasteListSeoInput {
  query: WasteListQuery
  result: RegionScheduleResponse | null
  regionalCanonical: string | null
  failed: boolean
}

interface WasteListSeoResult {
  noindex: boolean
  canonical: string | null
}

function hasSourceListFilter(query: WasteListQuery): boolean {
  return !!query.keyword || !!query.areaId || query.coverage === 'unresolved' || query.page > 1
}

export function wasteListSeo(input: WasteListSeoInput): WasteListSeoResult {
  if (input.failed || hasSourceListFilter(input.query) || !input.result || input.result.total <= 0 || !input.regionalCanonical) {
    return { noindex: true, canonical: null }
  }

  return { noindex: false, canonical: input.regionalCanonical }
}
