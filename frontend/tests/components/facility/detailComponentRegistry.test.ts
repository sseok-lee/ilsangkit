import { describe, it, expect } from 'vitest'
import {
  detailComponentFor,
  SUPPORTED_DETAIL_CATEGORIES,
} from '~/components/facility/detailComponentRegistry'
import { FACILITY_CATEGORIES, type FacilityCategory } from '~/types/facility'

// trash는 좌표 없는 일정 데이터(WasteSchedule) — /trash/ 별도 라우트로 처리.
// [category]/[id] 라우트를 거치지 않으므로 registry에서도 null.
const SUPPORTED: FacilityCategory[] = [
  'toilet',
  'wifi',
  'clothes',
  'parking',
  'aed',
  'library',
  'hospital',
  'pharmacy',
  'park',
  'school',
  'market',
  'childcare',
  'ev-charger',
  'sports',
]

describe('detailComponentRegistry', () => {
  it.each(SUPPORTED)('returns a component for "%s"', (category) => {
    expect(detailComponentFor(category)).toBeTruthy()
  })

  it('returns null for trash (handled by /trash route)', () => {
    expect(detailComponentFor('trash')).toBeNull()
  })

  it('SUPPORTED_DETAIL_CATEGORIES covers every FACILITY_CATEGORIES entry except trash', () => {
    const expected = FACILITY_CATEGORIES.filter((c) => c !== 'trash').slice().sort()
    expect([...SUPPORTED_DETAIL_CATEGORIES].sort()).toEqual(expected)
  })
})
