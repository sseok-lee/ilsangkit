import { CITY_SLUGS } from '~/shared/regionSlugs'
import { FACILITY_CATEGORIES } from '~/types/facility'

const FACILITY_CATEGORY_SET = new Set<string>(FACILITY_CATEGORIES)
const CITY_SLUG_SET = new Set<string>(Object.values(CITY_SLUGS))
const STRICT_POSITIVE_INTEGER = /^0*[1-9]\d*$/
const DUPLICATED_PAGE_QUERY = /^(0*[1-9]\d*)(?:\?page=\1)+$/

export const PAGINATION_ROBOTS_CONTENT = 'noindex, follow'

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

function normalizePositivePageValue(value: unknown): string | null {
  const raw = firstQueryValue(value)?.trim()
  if (!raw) return null

  if (STRICT_POSITIVE_INTEGER.test(raw)) {
    return String(Number.parseInt(raw, 10))
  }

  const duplicated = raw.match(DUPLICATED_PAGE_QUERY)
  if (duplicated) {
    return String(Number.parseInt(duplicated[1], 10))
  }

  return null
}

export function parsePositivePageQuery(value: unknown): number {
  const normalized = normalizePositivePageValue(value)
  return normalized ? Number.parseInt(normalized, 10) : 1
}

function isFacilityListPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length === 1) {
    return FACILITY_CATEGORY_SET.has(parts[0])
  }

  if (parts.length === 3) {
    const [city, , category] = parts
    return CITY_SLUG_SET.has(city) && FACILITY_CATEGORY_SET.has(category)
  }

  return false
}

function getCanonicalPageValue(pageValues: string[]): string | null {
  if (pageValues.length === 0) return null

  const normalized = pageValues.map(value => normalizePositivePageValue(value))
  const first = normalized[0]
  if (!first) return null

  return normalized.every(value => value === first) ? first : null
}

export function normalizePageQueryForUrl(pathname: string, search: string): string | null {
  if (!search.includes('page=')) return null
  if (!isFacilityListPath(pathname)) return null

  const rawSearch = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(rawSearch)
  const pageValues = params.getAll('page')
  if (pageValues.length === 0) return null

  const canonicalPage = getCanonicalPageValue(pageValues)
  const isAlreadyCanonical = pageValues.length === 1 && canonicalPage === pageValues[0] && canonicalPage !== '1'
  if (isAlreadyCanonical) return null

  params.delete('page')
  if (canonicalPage && canonicalPage !== '1') {
    params.append('page', canonicalPage)
  }

  const nextSearch = params.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}
