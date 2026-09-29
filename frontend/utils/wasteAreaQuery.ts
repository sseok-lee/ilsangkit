import type { LocationQuery } from 'vue-router'
import { CITY_FULL_NAME_TO_SLUG, CITY_SLUG_MAP } from '~/shared/regionSlugs'
import type { AreaQuery } from '~/types/wasteArea'

const DEFAULT_LIMIT = 20
const MAX_KEYWORD_LENGTH = 100
const POSITIVE_INTEGER = /^[1-9]\d*$/
const KOREAN_CITY_TO_API: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
  전남광주통합특별시: '전남광주통합특별시',
}

export class WasteAreaQueryError extends Error {
  statusCode = 400
}

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

export function normalizeWasteAreaCity(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (CITY_SLUG_MAP[value]) return KOREAN_CITY_TO_API[CITY_SLUG_MAP[value]] ?? CITY_SLUG_MAP[value]
  if (CITY_FULL_NAME_TO_SLUG[value]) return value
  if (KOREAN_CITY_TO_API[value]) return KOREAN_CITY_TO_API[value]
  invalid('지원하지 않는 city query 입니다')
}

function parsePage(value: string | undefined): number {
  if (value === undefined) return 1
  if (!POSITIVE_INTEGER.test(value)) invalid('page query must be a positive integer')
  const page = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(page)) invalid('page query must be a safe integer')
  return page
}

export function parseWasteAreaQuery(query: LocationQuery): AreaQuery {
  const city = normalizeWasteAreaCity(singleValue(query, 'city'))
  const district = singleValue(query, 'district')
  const keyword = singleValue(query, 'keyword')
  const page = parsePage(pageValue(query))
  const coverage = singleValue(query, 'coverage')

  if (district && !city) invalid('district query requires city query')
  if (keyword && keyword.length > MAX_KEYWORD_LENGTH) invalid('keyword query must be 100 characters or fewer')
  if (coverage && coverage !== 'unresolved') invalid('coverage query is invalid')

  return {
    ...(city ? { city } : {}),
    ...(district ? { district } : {}),
    ...(keyword ? { keyword } : {}),
    page,
    limit: DEFAULT_LIMIT,
    ...(coverage === 'unresolved' ? { coverage } : {}),
  }
}

export function wasteAreaRequestKey(query: AreaQuery): string {
  return `waste-areas:${JSON.stringify({
    city: query.city ?? null,
    district: query.district ?? null,
    keyword: query.keyword ?? null,
    coverage: query.coverage ?? null,
    page: query.page,
    limit: query.limit,
  })}`
}

export function wasteAreaPathForQuery(basePath: string, query: AreaQuery): string {
  const params = new URLSearchParams()
  if (query.city) params.set('city', query.city)
  if (query.district) params.set('district', query.district)
  if (query.keyword) params.set('keyword', query.keyword)
  if (query.coverage) params.set('coverage', query.coverage)
  if (query.page > 1) params.set('page', String(query.page))
  const search = params.toString()
  return search ? `${basePath}?${search}` : basePath
}

export interface WasteSourceScheduleQuery {
  page?: number
  limit?: number
  city?: string
  district?: string
  keyword?: string
  coverage?: 'unresolved'
}

export function wasteSourceScheduleQuery(query: AreaQuery): WasteSourceScheduleQuery {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.city ? { city: query.city } : {}),
    ...(query.district ? { district: query.district } : {}),
    ...(query.keyword ? { keyword: query.keyword } : {}),
    ...(query.coverage === 'unresolved' ? { coverage: query.coverage } : {}),
  }
}
