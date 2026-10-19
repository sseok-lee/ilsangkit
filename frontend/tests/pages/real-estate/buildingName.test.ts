import { describe, it, expect } from 'vitest'
import { shouldNoindexRealEstateDetail } from '../../../utils/realEstateNoindex'

/**
 * US-003 / AC3 — 상세 페이지 noindex 조건별 스냅샷.
 *
 * 빈값·1글자 이름 / buildingInfo 없음 두 조건 중 하나라도 true면
 * noindex여야 한다. 모두 false일 때만 index 가능.
 *
 * 참고: totalCount < 10 조건은 색인률 회복을 위해 2026-05 폐지.
 */
describe('shouldNoindexRealEstateDetail — AC3 gating', () => {
  const baseValid = {
    buildingName: '래미안강남',
    loaded: true,
    hasBuildingInfo: true,
  }

  it('indexes a valid building with sufficient transactions', () => {
    expect(shouldNoindexRealEstateDetail(baseValid)).toBe(false)
  })

  it('noindexes when buildingName is empty/1-char even before data loads', () => {
    expect(
      shouldNoindexRealEstateDetail({
        buildingName: 'a',
        loaded: false,
        hasBuildingInfo: false,
      }),
    ).toBe(true)
  })

  it.each(['(683-)', '123-4', '(386-2)청구빌라', '(3-1)아파트'])(
    'indexes jibun-style buildingName %s (released 2026-10-19)',
    (buildingName) => {
      expect(
        shouldNoindexRealEstateDetail({ ...baseValid, buildingName }),
      ).toBe(false)
    },
  )

  it('noindexes when data loaded and buildingInfo is missing', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        hasBuildingInfo: false,
      }),
    ).toBe(true)
  })

  it('indexes when data loaded and totalCount is low (totalCount condition removed 2026-05)', () => {
    // totalCount < 10 은 더 이상 noindex 조건이 아님
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
      }),
    ).toBe(false)
  })

  it('indexes when totalCount is absent — only name validity and buildingInfo gate noindex', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
      }),
    ).toBe(false)
  })

  it('does NOT noindex while data is still loading (avoid false positives during SSR)', () => {
    expect(
      shouldNoindexRealEstateDetail({
        buildingName: '래미안강남',
        loaded: false,
        hasBuildingInfo: false,
      }),
    ).toBe(false)
  })

  it('accepts company-prefix names like (주)래미안타워', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        buildingName: '(주)래미안타워',
      }),
    ).toBe(false)
  })

  it('indexes regardless of totalCount (condition removed 2026-05)', () => {
    // totalCount는 더 이상 noindex 판단에 영향을 주지 않음
    expect(
      shouldNoindexRealEstateDetail({ ...baseValid }),
    ).toBe(false)
  })
})
