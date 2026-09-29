import { CITY_SLUGS, CITY_SLUG_MAP, DISTRICT_SLUG_MAP, REGIONS } from '~/shared/regionSlugs'

export interface NormalizedMarketRegion {
  city: string | null
  district: string | null
}

const CITY_NAME_BY_SLUG = CITY_SLUG_MAP
const CITY_SLUG_BY_NAME = new Map<string, string>(
  Object.entries(CITY_SLUGS).map(([name, slug]) => [name, slug])
)

const DISTRICT_NAME_BY_SLUG_BY_CITY = new Map<string, Map<string, string>>(
  Object.entries(REGIONS).map(([cityName, districts]) => [
    CITY_SLUG_BY_NAME.get(cityName) ?? cityName,
    new Map(districts.map((district) => [DISTRICT_SLUG_MAP[district] ?? district.toLowerCase(), district])),
  ])
)

function normalizeCity(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (CITY_NAME_BY_SLUG[trimmed]) return trimmed
  return CITY_SLUG_BY_NAME.get(trimmed) ?? null
}

function normalizeDistrict(citySlug: string | null, value: unknown): string | null {
  if (!citySlug || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const cityName = CITY_NAME_BY_SLUG[citySlug]
  const districtNames = cityName ? REGIONS[cityName] : undefined
  if (!districtNames) return null

  if (districtNames.includes(trimmed)) {
    return DISTRICT_SLUG_MAP[trimmed] ?? null
  }

  const districtName = DISTRICT_NAME_BY_SLUG_BY_CITY.get(citySlug)?.get(trimmed)
  return districtName ? DISTRICT_SLUG_MAP[districtName] ?? null : null
}

function hasSuppliedDistrict(value: unknown): boolean {
  if (value === null || value === undefined) return false
  return typeof value === 'string' ? value.trim().length > 0 : true
}

export function normalizeMarketRegion(value: unknown): NormalizedMarketRegion {
  if (!value || typeof value !== 'object') {
    return { city: null, district: null }
  }

  const raw = value as { city?: unknown; district?: unknown }
  const city = normalizeCity(raw.city)
  const district = normalizeDistrict(city, raw.district)

  if (city && hasSuppliedDistrict(raw.district) && !district) {
    return { city: null, district: null }
  }

  return { city, district }
}
