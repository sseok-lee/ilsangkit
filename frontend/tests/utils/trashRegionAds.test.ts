import { describe, expect, it } from 'vitest'
import { shouldShowTrashRegionAd, type TrashRegionAdState } from '~/utils/trashRegionAds'

const base: TrashRegionAdState = {
  isTrash: true,
  hasQuery: false,
  coverage: null,
  showWasteAreaList: true,
  wasteAreaItemCount: 1,
  wasteAreaError: false,
  wasteScheduleCount: 1,
  wasteScheduleError: false,
}

describe('shouldShowTrashRegionAd', () => {
  it('keeps non-trash region ads enabled', () => {
    expect(shouldShowTrashRegionAd({ ...base, isTrash: false, hasQuery: true, wasteAreaItemCount: 0 })).toBe(true)
  })

  it('suppresses trash region ads for query, unresolved, error, and empty area-list states', () => {
    expect(shouldShowTrashRegionAd({ ...base, hasQuery: true })).toBe(false)
    expect(shouldShowTrashRegionAd({ ...base, coverage: 'unresolved' })).toBe(false)
    expect(shouldShowTrashRegionAd({ ...base, wasteAreaError: true })).toBe(false)
    expect(shouldShowTrashRegionAd({ ...base, wasteAreaItemCount: 0 })).toBe(false)
  })

  it('suppresses legacy schedule trash ads on error or empty schedules', () => {
    expect(shouldShowTrashRegionAd({ ...base, showWasteAreaList: false, wasteScheduleError: true })).toBe(false)
    expect(shouldShowTrashRegionAd({ ...base, showWasteAreaList: false, wasteScheduleCount: 0 })).toBe(false)
    expect(shouldShowTrashRegionAd({ ...base, showWasteAreaList: false, wasteScheduleCount: 2 })).toBe(true)
  })
})
