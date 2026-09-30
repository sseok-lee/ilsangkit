import { toCitySlug, toRealEstateListUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { buildMapHash } from '~/composables/useRealEstateMap'

export interface ExplorationRegion {
  city: string
  district?: string
}

export function explorationListHref(type: RealEstateUrlType, region: ExplorationRegion | null): string {
  if (!region) return `/real-estate/${type}`
  if (!region.district) return `/real-estate/${type}/${toCitySlug(region.city)}`
  return toRealEstateListUrl({ type, city: region.city, district: region.district })
}

export function explorationMapHref(
  type: RealEstateUrlType,
  center: { lat: number; lng: number; level: number } | null,
): string {
  const resolvedCenter = center ?? { lat: 36.5, lng: 127.8, level: 13 }
  return `/real-estate${buildMapHash({ type, ...resolvedCenter })}`
}
