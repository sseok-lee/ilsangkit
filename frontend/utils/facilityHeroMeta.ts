import { getOperatingStatus, type OperatingStatus } from '~/utils/facilityStatus'
import type { FacilityCategory, FacilityDetail } from '~/types/facility'

const CATEGORIES_WITHOUT_STATUS_BADGE = new Set<FacilityCategory>([
  'wifi',
  'clothes',
  'parking',
  'ev-charger',
  'subway',
])

/**
 * Returns operating status for the hero badge, or null for categories without
 * meaningful open/closed semantics (wifi, clothes, parking, ev-charger, subway).
 * For hospital, mirrors `details.trmt*` into `extras` so getOperatingStatus
 * (which reads from `extras` for the hospital branch) can find the times.
 */
export function buildHeroBadge(facility: FacilityDetail): OperatingStatus {
  if (CATEGORIES_WITHOUT_STATUS_BADGE.has(facility.category)) return null

  // getOperatingStatus reads `extras.trmt*Start/End` for hospital, but FacilityDetail
  // keeps those fields in `details`. Mirror the data so the hospital branch finds them.
  const normalized = facility.category === 'hospital'
    ? { ...facility, extras: facility.details }
    : facility

  return getOperatingStatus(normalized as unknown as Record<string, unknown>)
}
