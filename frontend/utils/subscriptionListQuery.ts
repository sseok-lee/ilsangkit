import type { CityData } from '~/composables/useRegions'
import type {
  SubscriptionApiSort,
  SubscriptionListFilters,
  SubscriptionListScope,
  SubscriptionListSort,
  SubscriptionStatus,
} from '~/types/subscriptionList'
import { RENT_TYPES, SALE_TYPES } from '~/utils/subscriptionMeta'

type QueryInput = Record<string, string | null | (string | null | undefined)[] | undefined>

const STATUS_VALUES = new Set<SubscriptionStatus>(['upcoming', 'ongoing', 'closed', 'unknown'])
const SORT_VALUES = new Set<SubscriptionListSort>(['priority', 'deadline', 'recent'])
const KEYWORD_MAX_LENGTH = 100
const KEYWORD_ERROR = '검색어는 100자 이하로 입력해 주세요.'

function firstQueryValue(value: QueryInput[string]): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }
  return typeof value === 'string' ? value : ''
}

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeStatus(value: string, scope: SubscriptionListScope): SubscriptionListFilters['status'] {
  if (!STATUS_VALUES.has(value as SubscriptionStatus)) return 'all'
  if (value === 'unknown' && (scope.category === 'sale' || scope.type === 'private' || scope.sourceType === 'PRIVATE_RENT')) return 'all'
  return value as SubscriptionStatus
}

function normalizeSort(value: string): SubscriptionListSort {
  return SORT_VALUES.has(value as SubscriptionListSort) ? value as SubscriptionListSort : 'priority'
}

function normalizeRegion(
  cityValue: string,
  districtValue: string,
  cities: CityData[],
): Pick<SubscriptionListFilters, 'city' | 'district'> {
  const city = cities.find((entry) => entry.name === cityValue)
  if (!city) return { city: '', district: '' }

  const district = city.districts.find((entry) => entry.name === districtValue)
  return {
    city: city.name,
    district: district?.name ?? '',
  }
}

export function normalizeSubscriptionQuery(
  query: QueryInput,
  scope: SubscriptionListScope,
  cities: CityData[],
): { filters: SubscriptionListFilters; query: Record<string, string>; keywordError: string | null } {
  const q = normalizeKeyword(firstQueryValue(query.q))
  const region = normalizeRegion(
    firstQueryValue(query.city),
    firstQueryValue(query.district),
    cities,
  )
  const status = normalizeStatus(firstQueryValue(query.status), scope)
  const sort = normalizeSort(firstQueryValue(query.sort))
  const keywordError = q.length > KEYWORD_MAX_LENGTH ? KEYWORD_ERROR : null

  const filters: SubscriptionListFilters = {
    q,
    city: region.city,
    district: region.district,
    status,
    sort,
  }

  const normalizedQuery: Record<string, string> = {}
  if (q && !keywordError) normalizedQuery.q = q
  if (region.city) normalizedQuery.city = region.city
  if (region.district) normalizedQuery.district = region.district
  if (status !== 'all') normalizedQuery.status = status
  if (sort !== 'priority') normalizedQuery.sort = sort

  return { filters, query: normalizedQuery, keywordError }
}

export function subscriptionApiParams(
  scope: SubscriptionListScope,
  filters: SubscriptionListFilters,
  page: number,
): {
  category: 'sale' | 'rent'
  sourceType: SubscriptionListScope['sourceType']
  rentType: string | undefined
  q: string | undefined
  region: string | undefined
  status: SubscriptionStatus | undefined
  sort: SubscriptionApiSort
  page: number
  limit: number
} {
  return {
    category: scope.category,
    sourceType: scope.sourceType,
    rentType: scope.rentType,
    q: filters.q || undefined,
    region: [filters.city, filters.district].filter(Boolean).join(' ') || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    sort: filters.sort,
    page,
    limit: 20,
  }
}

export function subscriptionListKey(
  scope: SubscriptionListScope,
  filters: SubscriptionListFilters,
): string {
  return [
    scope.category,
    scope.type ?? '',
    scope.sourceType ?? '',
    scope.rentType ?? '',
    filters.q,
    filters.city,
    filters.district,
    filters.status,
    filters.sort,
  ].join(':')
}

export function subscriptionScopeForPath(path: string): SubscriptionListScope | null {
  const normalizedPath = path.replace(/\/+$/, '') || '/'
  const parts = normalizedPath.split('/').filter(Boolean)
  if (parts[0] !== 'subscription') return null
  if (parts.length > 3) return null

  const category = parts[1]
  const type = parts[2]

  if (category === 'sale') {
    if (!type) return { category: 'sale' }
    const meta = SALE_TYPES[type]
    if (!meta) return null
    return { category: 'sale', type, sourceType: meta.sourceType }
  }

  if (category === 'rent') {
    if (!type) return { category: 'rent' }
    const meta = RENT_TYPES[type]
    if (!meta) return null
    return { category: 'rent', type, sourceType: meta.sourceType, rentType: meta.rentType }
  }

  return null
}
