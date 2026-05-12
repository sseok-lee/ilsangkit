import { getOperatingStatus, type OperatingStatus } from '~/utils/facilityStatus'
import type { FacilityCategory, FacilityDetail } from '~/types/facility'

const BADGE_OMIT: FacilityCategory[] = ['wifi', 'clothes', 'parking', 'ev-charger']

export function buildHeroBadge(facility: FacilityDetail): OperatingStatus {
  if (BADGE_OMIT.includes(facility.category)) return null
  return getOperatingStatus(facility as unknown as Record<string, unknown>)
}
