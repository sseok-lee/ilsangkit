import type { FacilityCategory } from '~/types/facility'

export interface UnifiedSearchQuery {
  q: string
  tab: 'all' | 'buildings' | 'facilities'
  property: 'apt' | 'villa' | 'offitel' | null
  page: number
  facilityCategory: FacilityCategory | null
}

export interface SearchDomainState<T> {
  status: 'idle' | 'pending' | 'success' | 'error'
  data: T | null
  error: string | null
  keyword: string
}
