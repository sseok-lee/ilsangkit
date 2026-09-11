export interface FacilityListRobotsInput {
  page: number
  keyword?: string
  query?: Record<string, unknown>
}

/**
 * page 2+ / nonblank keyword retain their existing policy.
 * lat/lng/q use key presence: blank, repeated, or malformed values still name
 * an excluded query URL. Stable city/district and schedule are not exclusions.
 */
export function shouldNoindexFacilityList(input: FacilityListRobotsInput): boolean {
  return input.page >= 2 || !!input.keyword?.trim()
    || ['lat', 'lng', 'q'].some(key => Object.prototype.hasOwnProperty.call(input.query ?? {}, key))
}
