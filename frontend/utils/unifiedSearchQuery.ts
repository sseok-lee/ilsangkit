import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { isFacilityCategory } from '~/types/facility'
import type { UnifiedSearchQuery } from '~/types/unifiedSearch'

function firstString(value: LocationQuery[string]): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? first : undefined
}

export function parseUnifiedSearchQuery(query: LocationQuery): UnifiedSearchQuery {
  const rawKeyword = Object.hasOwn(query, 'q') ? query.q : query.keyword
  const q = firstString(rawKeyword)?.trim() ?? ''
  const rawTab = firstString(query.tab)
  const tab = rawTab === 'buildings' || rawTab === 'facilities' ? rawTab : 'all'
  const rawProperty = firstString(query.property)
  const property = rawProperty === 'apt' || rawProperty === 'villa' || rawProperty === 'offitel'
    ? rawProperty
    : null
  const rawPage = firstString(query.page)
  const parsedPage = rawPage ? Number(rawPage) : 1
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const rawFacilityCategory = firstString(query.facilityCategory)
  const facilityCategory = rawFacilityCategory && isFacilityCategory(rawFacilityCategory)
    ? rawFacilityCategory
    : null

  return { q, tab, property, page, facilityCategory }
}

export function toUnifiedSearchQuery(state: UnifiedSearchQuery): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  const q = state.q.trim()

  if (q) query.q = q
  if (state.tab !== 'all') query.tab = state.tab

  if (state.tab === 'buildings') {
    if (state.property) query.property = state.property
    if (state.page > 1) query.page = String(state.page)
  }

  if (state.tab === 'facilities' && state.facilityCategory) {
    query.facilityCategory = state.facilityCategory
  }

  return query
}
