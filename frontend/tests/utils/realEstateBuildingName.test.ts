import { describe, it, expect } from 'vitest'
import {
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

const INVALID = ['  ', '', 'a', '1']

const JIBUN_NOW_VALID = ['(683-)', '(966)', '123-4', '(386-2)청구빌라', '(535-3)', '(3-1)아파트', '()']

describe('isValidBuildingName (frontend)', () => {
  for (const name of JIBUN_NOW_VALID) {
    it(`accepts jibun-style ${JSON.stringify(name)} (2026-10-19 released)`, () => {
      expect(isValidBuildingName(name)).toBe(true)
    })
  }

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
