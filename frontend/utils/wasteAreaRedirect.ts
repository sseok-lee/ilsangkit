import type { AreaDetail, WasteAreaSchedule } from '~/types/wasteArea'
import { wasteAreaFilterHref } from '~/utils/wasteListQuery'

const POSITIVE_SAFE_INTEGER = /^[1-9]\d*$/

function assertPositiveSafeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}`)
  }
  if (!POSITIVE_SAFE_INTEGER.test(String(value))) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

function scheduleId(item: WasteAreaSchedule): number {
  if (!item || typeof item !== 'object' || !item.schedule || typeof item.schedule !== 'object') {
    throw new Error('Invalid schedule entry')
  }
  return assertPositiveSafeInteger(item.schedule.id, 'schedule id')
}

export function wasteAreaRedirectTarget(detail: AreaDetail): string {
  const areaId = assertPositiveSafeInteger(detail?.area?.areaId, 'areaId')
  if (!Array.isArray(detail.schedules)) throw new Error('Invalid schedules')

  const sourceIds = [...new Set(detail.schedules.map(scheduleId))]
  const areaHref = wasteAreaFilterHref(areaId)
  if (sourceIds.length !== 1) return areaHref

  return `/trash/${sourceIds[0]}#from=${encodeURIComponent(areaHref)}`
}
