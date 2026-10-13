import type { LocationQuery } from 'vue-router'
import type { WasteListQuery } from '~/types/wasteList'
import { normalizeWasteAreaCity, WasteAreaQueryError } from '~/utils/wasteAreaQuery'

const DEFAULT_LIMIT = 20
const MAX_KEYWORD_LENGTH = 100
const POSITIVE_INTEGER = /^[1-9]\d*$/

function invalid(message: string): never {
  throw new WasteAreaQueryError(message)
}

function singleValue(query: LocationQuery, key: string): string | undefined {
  const value = query[key]
  if (Array.isArray(value)) invalid(`${key} query must not be duplicated`)
  if (value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function pageValue(query: LocationQuery): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(query, 'page')) return undefined
  const value = query.page
  if (Array.isArray(value)) invalid('page query must not be duplicated')
  if (typeof value !== 'string') invalid('page query must be a positive integer')
  const trimmed = value.trim()
  if (!trimmed) invalid('page query must be a positive integer')
  return trimmed
}

function parsePositiveInteger(value: string | undefined, field: string, defaultValue?: number): number {
  if (value === undefined) {
    if (defaultValue === undefined) invalid(`${field} query is required`)
    return defaultValue
  }
  if (!POSITIVE_INTEGER.test(value)) invalid(`${field} query must be a positive integer`)
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed)) invalid(`${field} query must be a safe integer`)
  return parsed
}

export function parseWasteListQuery(query: LocationQuery, region?: { city: string; district: string }): WasteListQuery {
  const queryCity = normalizeWasteAreaCity(singleValue(query, 'city'))
  const queryDistrict = singleValue(query, 'district')
  const areaIdValue = singleValue(query, 'areaId')
  const keyword = singleValue(query, 'keyword')
  const coverage = singleValue(query, 'coverage')
  const page = parsePositiveInteger(pageValue(query), 'page', 1)

  if (queryDistrict && !queryCity && !region) invalid('district query requires city query')
  if (keyword && keyword.length > MAX_KEYWORD_LENGTH) invalid('keyword query must be 100 characters or fewer')
  if (coverage && coverage !== 'unresolved') invalid('coverage query is invalid')
  if (region && queryCity && queryCity !== region.city) invalid('city query conflicts with path region')
  if (region && queryDistrict && queryDistrict !== region.district) invalid('district query conflicts with path region')

  const areaId = areaIdValue ? parsePositiveInteger(areaIdValue, 'areaId') : undefined
  if (areaId && coverage) invalid('areaId query cannot be combined with coverage')

  const city = region?.city ?? queryCity
  const district = region?.district ?? queryDistrict

  return {
    ...(city ? { city } : {}),
    ...(district ? { district } : {}),
    ...(areaId ? { areaId } : {}),
    ...(keyword ? { keyword } : {}),
    ...(coverage === 'unresolved' ? { coverage } : {}),
    page,
    limit: DEFAULT_LIMIT,
  }
}

export function wasteListPathForQuery(basePath: string, query: WasteListQuery): string {
  const params = new URLSearchParams()
  if (query.city) params.set('city', query.city)
  if (query.district) params.set('district', query.district)
  if (query.areaId) params.set('areaId', String(query.areaId))
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.coverage) params.set('coverage', query.coverage)
  if (query.page > 1) params.set('page', String(query.page))
  if (query.limit !== DEFAULT_LIMIT) params.set('limit', String(query.limit))
  const search = params.toString()
  return search ? `${basePath}?${search}` : basePath
}

export function wasteListRequestKey(query: WasteListQuery): string {
  return `waste-list:${JSON.stringify({
    city: query.city ?? null,
    district: query.district ?? null,
    areaId: query.areaId ?? null,
    keyword: query.keyword ?? null,
    coverage: query.coverage ?? null,
    page: query.page,
    limit: query.limit,
  })}`
}

export function wasteAreaFilterHref(areaId: number): string {
  return wasteListPathForQuery('/trash', { areaId, page: 1, limit: DEFAULT_LIMIT })
}
