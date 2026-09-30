import type { RentTransaction, SaleTransaction } from './realEstate'

export type DealMode = 'sale' | 'jeonse' | 'wolse'
/** 0 selects all available transaction history. */
export type PeriodMonths = 0 | 6 | 12 | 36
export type PropertyType = 'apt' | 'villa' | 'offitel'

export interface DateWindow {
  from: string
  to: string
}

export interface DetailIdentity {
  buildingKey?: string
  canonicalPath?: string | null
  legacyGrouped?: boolean
  bjdCode: string
  buildingName: string
}

export interface DetailQuery extends DetailIdentity {
  mode: DealMode
  months: PeriodMonths
  area?: string
  deposit?: number
}

export interface AppliedFilters extends DetailIdentity {
  mode: DealMode
  months: PeriodMonths
  area: string | null
  deposit: number | null
}

export interface DealPoint {
  id: number
  date: string
  amount: number
  area: string
  floor: number | null
  deposit: number | null
}

export interface DetailOptions {
  areas: string[]
  deposits: Array<{ amount: number; count: number }>
}

export interface DetailPage<Row = SaleTransaction | RentTransaction> {
  items: Row[]
  total: number
  page: number
  totalPages: number
}

export interface DetailSnapshot<Row = SaleTransaction | RentTransaction> {
  filters: AppliedFilters
  window: DateWindow
  options: DetailOptions
  points: DealPoint[]
  table: DetailPage<Row>
  generatedAt: string
  adjustment: 'area-reset' | 'deposit-reset' | null
}

export interface LatestSale {
  id: number
  amount: number
  year: number
  month: number
  day: number | null
  area: string | null
  floor: number | null
}

export interface DetailOverview {
  identity: DetailIdentity
  latestSale: LatestSale | null
  buildYear: number | null
  minArea: string | null
  maxArea: string | null
  saleCount6m: number
  window6m: DateWindow
  addresses: Array<{ dongName: string; jibun: string | null; roadName: string | null }>
  location: { lat: number; lng: number } | null
  locationAmbiguous: boolean
  generatedAt: string
}

export type SectionResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; data: null; code: 'UNAVAILABLE' }

export interface MarketRegion {
  city: string | null
  district: string | null
  label: string
}

export interface MarketCount {
  total: number
  daily: Array<{ date: string; count: number }>
}

export interface RecentBuilding {
  buildingKey?: string
  canonicalPath?: string | null
  type: PropertyType
  transactionId: number
  city: string
  district: string
  bjdCode: string
  buildingName: string
  dongName?: string | null
  jibun: string | null
  date: string
  amount: number
  area: string | null
}

export interface HomeMarket {
  region: MarketRegion
  window: DateWindow
  generatedAt: string
  counts: Record<PropertyType, SectionResult<MarketCount>>
  recent: SectionResult<RecentBuilding[]>
}
