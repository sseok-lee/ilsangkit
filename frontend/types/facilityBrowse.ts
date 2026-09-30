import type { FacilityCategory } from '~/types/facility'

export type BrowseCategory = FacilityCategory

export interface BrowseFilters {
  city: string
  district: string
  category: BrowseCategory | ''
  q: string
  page: number
  departments: string[]
}

export interface BrowseItem {
  id: string
  category: BrowseCategory
  name: string
  address: string | null
  roadAddress: string | null
  lat: number | null
  lng: number | null
  extras: Record<string, unknown>
  destination?: { kind: 'waste-area'; href: string }
}

export interface BrowseGroup {
  category: BrowseCategory
  label: string
  unit: '시설' | '충전소' | '장소' | '역' | '일정' | '지역'
  count: number
  items: BrowseItem[]
}

export type BrowseResult = { mode: 'grouped'; groups: BrowseGroup[] } | {
  mode: 'list'
  category: BrowseCategory
  unit: BrowseGroup['unit']
  items: BrowseItem[]
  total: number
  page: number
  totalPages: number
}
