// 카테고리 (camelCase, 내부 사용)
export type RealEstateCategory = 'aptSale' | 'aptRent' | 'villaSale' | 'villaRent' | 'offitelSale' | 'offitelRent'

// URL slug (kebab-case)
export type RealEstateType = 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'

// 건물 유형 (통합 페이지용)
export type RealEstatePropertyType = 'apt' | 'villa' | 'offitel'

// 거래 유형
export type TransactionMode = 'sale' | 'rent'

// 건물 유형 배열
export const PROPERTY_TYPES = ['apt', 'villa', 'offitel'] as const

// 매매 거래
export interface SaleTransaction {
  id: number
  city: string
  district: string
  bjdCode: string
  dongName: string
  buildingName: string
  buildYear: number | null
  floor: number | null
  exclusiveArea: number | null
  jibun: string | null
  roadName: string | null
  lat: number | null
  lng: number | null
  dealYear: number
  dealMonth: number
  dealDay: number | null
  dealAmount: number  // 만원 단위
  dealType: string | null
  // P0: 취소 거래
  cancelDealDay: string | null
  cancelDealType: string | null
  // P2: 매수/매도자 유형
  buyerType: string | null
  sellerType: string | null
}

// 전월세 거래
export interface RentTransaction {
  id: number
  city: string
  district: string
  bjdCode: string
  dongName: string
  buildingName: string
  buildYear: number | null
  floor: number | null
  exclusiveArea: number | null
  jibun: string | null
  roadName: string | null
  lat: number | null
  lng: number | null
  dealYear: number
  dealMonth: number
  dealDay: number | null
  rentType: string  // 전세 | 월세
  deposit: number   // 보증금 만원
  monthlyRent: number | null  // 월세 만원
  contractTerm: number | null  // 계약기간 월
  // P1: 계약유형 + 이전 가격
  contractType: string | null  // 신규 | 갱신
  preDeposit: number | null    // 이전 보증금 만원
  preMonthlyRent: number | null  // 이전 월세 만원
  useRenewalRight: string | null  // 갱신권 사용 여부
}

// 월별 시세 통계
export interface TransactionStats {
  year: number
  month: number
  avgPrice: number
  maxPrice: number
  minPrice: number
  count: number
}

// 면적별 거래 그룹
export interface AreaGroup {
  area: number
  pyeong: number
  count: number
}

// 통계 요약
export interface StatsSummary {
  recentAvg: number | null
  previousAvg: number | null
  changeRate: number | null
  totalCount: number
  lowVolume: boolean
  priceLabel: string
}

// 통계 응답 (monthly + summary)
export interface StatsResponse {
  monthly: TransactionStats[]
  summary: StatsSummary
}

// 건물 정보
export interface ComplexInfo {
  buildingName: string
  bjdCode: string
  dongName: string
  city: string
  district: string
  latestPrice: number | null
  transactionCount: number
  lat: number | null
  lng: number | null
}

// 건물 상세 정보
export interface BuildingInfo {
  buildingName: string
  city: string
  district: string
  dongName: string
  roadName: string | null
  jibun: string | null
  buildYear: number | null
  minArea: number | null
  maxArea: number | null
  latestDealAmount: number | null
  latestDealYear: number | null
  latestDealMonth: number | null
  lat: number | null
  lng: number | null
}

// 건물 목록 응답 (페이지네이션)
export interface ComplexListResponse {
  items: ComplexInfo[]
  total: number
  page: number
  totalPages: number
}

// 검색 응답
export interface RealEstateSearchResponse {
  items: (SaleTransaction | RentTransaction)[]
  total: number
  page: number
  totalPages: number
}

// 통합검색 카테고리 결과
export interface RealEstateGroupedCategory {
  category: RealEstateCategory
  label: string
  count: number
  items: (SaleTransaction | RentTransaction)[]
}

// 통합검색 응답
export interface RealEstateGroupedResponse {
  categories: RealEstateGroupedCategory[]
  totalCount: number
}

// 카테고리 <-> slug 매핑 테이블
const CATEGORY_TO_SLUG_MAP: Record<RealEstateCategory, RealEstateType> = {
  aptSale: 'apt-sale',
  aptRent: 'apt-rent',
  villaSale: 'villa-sale',
  villaRent: 'villa-rent',
  offitelSale: 'offitel-sale',
  offitelRent: 'offitel-rent',
}

const SLUG_TO_CATEGORY_MAP: Record<RealEstateType, RealEstateCategory> = {
  'apt-sale': 'aptSale',
  'apt-rent': 'aptRent',
  'villa-sale': 'villaSale',
  'villa-rent': 'villaRent',
  'offitel-sale': 'offitelSale',
  'offitel-rent': 'offitelRent',
}

// aptSale -> apt-sale
export function categoryToSlug(cat: RealEstateCategory): RealEstateType {
  return CATEGORY_TO_SLUG_MAP[cat]
}

// apt-sale -> aptSale
export function slugToCategory(slug: RealEstateType): RealEstateCategory {
  return SLUG_TO_CATEGORY_MAP[slug]
}

// 모든 카테고리 배열
export const REAL_ESTATE_CATEGORIES: readonly RealEstateCategory[] = [
  'aptSale',
  'aptRent',
  'villaSale',
  'villaRent',
  'offitelSale',
  'offitelRent',
] as const

// 모든 타입(slug) 배열
export const REAL_ESTATE_TYPES: readonly RealEstateType[] = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
] as const

// 건물유형 → 매매 slug
export function propertyTypeToSaleSlug(pt: RealEstatePropertyType): RealEstateType {
  return `${pt}-sale` as RealEstateType
}

// 건물유형 → 전월세 slug
export function propertyTypeToRentSlug(pt: RealEstatePropertyType): RealEstateType {
  return `${pt}-rent` as RealEstateType
}

// 건물유형 + 거래유형 → API slug
export function toApiSlug(pt: RealEstatePropertyType, mode: TransactionMode): RealEstateType {
  return `${pt}-${mode}` as RealEstateType
}

// slug → 건물유형 (apt-sale → apt, apt → apt)
export function propertyTypeFromSlug(slug: string): RealEstatePropertyType | null {
  const base = slug.replace(/-(?:sale|rent)$/, '')
  if (base === 'apt' || base === 'villa' || base === 'offitel') return base
  return null
}
