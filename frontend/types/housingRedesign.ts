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
  /** 이상거래 판정(같은 면적 그룹·거래 유형 기준). 월세는 항상 'normal'. */
  flag: DealFlag
}

export type DealFlag = 'normal' | 'direct' | 'outlier'

export interface AreaOption {
  /** 면적 그룹 키 = ROUND(전용면적) */
  key: string
  /** 그룹 내 최다 빈도 전용면적의 소수 버림 */
  label: string
  /** 현재 모드의 최근 36개월 거래 수 */
  count: number
}

export interface AreaGroup {
  key: string
  label: string
  pyeong: number
  saleCount36m: number
  jeonseCount36m: number
}

export interface BasisDealRef {
  id: number
  date: string
  amount: number
  floor: number | null
}

export interface ExcludedDeal extends BasisDealRef {
  reason: 'direct' | 'outlier'
  deviation: number | null
}

export interface PriceBasis {
  representative: number | null
  sampleCount: number
  latest: BasisDealRef | null
  max12m: number | null
  yearAgo: number | null
  changeRate: number | null
  excluded: ExcludedDeal[]
}

export interface DetailOptions {
  areas: AreaOption[]
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
  /** 대표 시세 기준 거래 유형: 매매 URL 'sale', 전월세 URL 'jeonse' */
  basisMode: 'sale' | 'jeonse'
  defaultAreaGroup: string | null
  areaGroups: AreaGroup[]
  /** 면적 그룹 key → 매매 기준 */
  saleBasis: Record<string, PriceBasis>
  /** 면적 그룹 key → 전세 기준 */
  jeonseBasis: Record<string, PriceBasis>
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
