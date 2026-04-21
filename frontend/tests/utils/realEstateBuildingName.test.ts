import { describe, it, expect } from 'vitest'
import {
  INVALID_BUILDING_NAME,
  isValidBuildingName,
} from '../../utils/realEstateBuildingName'

/**
 * Frontend 경량 fixture 테스트 (공유 로직이 backend와 동일함을 보장).
 * Backend 쪽에 AC18 픽스처 65건 상세 검증이 있으므로 frontend는 대표 케이스만 검사.
 */

const LEGIT = [
  '래미안강남',
  'ABC빌라',
  '(주)래미안타워',
  '(사)OO아파트',
  'e-편한세상',
  '103동-1',
]

const INVALID = [
  '(535-3)',
  '(535)',
  '123-456',
  '(3-1)아파트',
  '()',
  '  ',
  '',
  'a',
  '-1-2',
  '(1',
]

describe('INVALID_BUILDING_NAME regex (frontend)', () => {
  it('matches jibun patterns', () => {
    expect(INVALID_BUILDING_NAME.test('(535-3)')).toBe(true)
    expect(INVALID_BUILDING_NAME.test('123-456')).toBe(true)
  })

  it('does not match company-prefix or plain names', () => {
    expect(INVALID_BUILDING_NAME.test('(주)래미안타워')).toBe(false)
    expect(INVALID_BUILDING_NAME.test('래미안강남')).toBe(false)
  })
})

describe('isValidBuildingName (frontend)', () => {
  for (const name of LEGIT) {
    it(`accepts "${name}"`, () => {
      expect(isValidBuildingName(name)).toBe(true)
    })
  }

  for (const name of INVALID) {
    it(`rejects ${JSON.stringify(name)}`, () => {
      expect(isValidBuildingName(name)).toBe(false)
    })
  }

  it('rejects null and undefined', () => {
    expect(isValidBuildingName(null)).toBe(false)
    expect(isValidBuildingName(undefined)).toBe(false)
  })
})
