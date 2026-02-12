export type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited' | null

/**
 * 시설의 운영 상태를 판단
 */
export function getOperatingStatus(facility: Record<string, any>): OperatingStatus {
  const details = facility.details
  if (!details) return null

  // Check for 24h operation (toilet, kiosk)
  if (details.operatingHours === '24시간' || details.is24Hour) {
    return 'open24h'
  }

  // Check for operating status in wifi
  if (details.operationStatus === '운영') {
    return 'openNow'
  }

  // Check for closed status
  if (details.operationStatus === '중지' || details.status === 'closed') {
    return 'closed'
  }

  // Check for time-limited operation
  if (details.operatingHours || details.weekdayOperatingHours) {
    return 'limited'
  }

  return null
}
