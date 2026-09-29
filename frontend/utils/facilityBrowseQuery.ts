import { isFacilityCategory } from '~/types/facility'
import type { BrowseFilters } from '~/types/facilityBrowse'

function firstValue(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' || typeof first === 'number' ? String(first).trim() : ''
}

export function normalizeFacilityBrowseQuery(query: Record<string, unknown>): BrowseFilters {
  const q = firstValue(query.q)
  if (q.length > 100) throw new RangeError('검색어는 100자 이내로 입력해 주세요.')
  const rawCategory = firstValue(query.category)
  const category = isFacilityCategory(rawCategory) ? rawCategory : ''
  const rawPage = firstValue(query.page)
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  return {
    city: firstValue(query.city),
    district: firstValue(query.district),
    category,
    q,
    page: category && Number.isSafeInteger(page) && page > 0 ? page : 1,
    departments: category === 'hospital'
      ? [...new Set(firstValue(query.departments).split(',').map(value => value.trim()).filter(Boolean))]
      : [],
  }
}

export function toFacilityBrowseQuery(filters: BrowseFilters): Record<string, string> {
  const normalized = normalizeFacilityBrowseQuery({ ...filters, departments: filters.departments.join(',') })
  const query: Record<string, string> = {}
  for (const key of ['city', 'district', 'category', 'q'] as const) {
    if (normalized[key]) query[key] = normalized[key]
  }
  if (normalized.page > 1) query.page = String(normalized.page)
  if (normalized.departments.length) query.departments = normalized.departments.join(',')
  return query
}

export function changeBrowseRegion(filters: BrowseFilters, city: string): BrowseFilters {
  return { ...filters, city, district: '', page: 1, departments: [] }
}
