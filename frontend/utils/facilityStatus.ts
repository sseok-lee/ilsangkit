export type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited' | null

/**
 * 시설의 운영 상태를 판단
 */
export function getOperatingStatus(facility: Record<string, any>): OperatingStatus {
  // hospital: extras 기반 진료상태 판단
  if (facility.category === 'hospital') {
    const extras = facility.extras
    if (!extras) return null
    const now = new Date()
    const day = now.getDay() // 0=일 ~ 6=토
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const startKey = `trmt${dayMap[day]}Start`
    const endKey = `trmt${dayMap[day]}End`
    const start = extras[startKey] as string | undefined
    const end = extras[endKey] as string | undefined
    if (!start || !end) return null
    const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    if (hhmm >= start && hhmm <= end) return 'openNow'
    return 'closed'
  }

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
