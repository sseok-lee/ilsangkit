import { describe, it, expect } from 'vitest'
import { shouldNoindexRealEstateDetail } from '../../../utils/realEstateNoindex'

/**
 * US-003 / AC3 — 상세 페이지 noindex 조건별 스냅샷.
 *
 * 지번 패턴 / buildingInfo 없음 / 총 거래 < 10 세 조건 중 하나라도 true면
 * noindex여야 한다. 모두 false일 때만 index 가능.
 */
describe('shouldNoindexRealEstateDetail — AC3 gating', () => {
  const baseValid = {
    buildingName: '래미안강남',
    loaded: true,
    hasBuildingInfo: true,
    totalCount: 42,
  }

  it('indexes a valid building with sufficient transactions', () => {
    expect(shouldNoindexRealEstateDetail(baseValid)).toBe(false)
  })

  it('noindexes when buildingName is jibun-pattern even before data loads', () => {
    expect(
      shouldNoindexRealEstateDetail({
        buildingName: '(535-3)',
        loaded: false,
        hasBuildingInfo: false,
        totalCount: 0,
      }),
    ).toBe(true)
  })

  it('noindexes when buildingName is digit-opener paren prefix', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        buildingName: '(3-1)아파트',
      }),
    ).toBe(true)
  })

  it('noindexes when data loaded and buildingInfo is missing', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        hasBuildingInfo: false,
      }),
    ).toBe(true)
  })

  it('noindexes when data loaded and totalCount < 10', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        totalCount: 9,
      }),
    ).toBe(true)
  })

  it('noindexes when totalCount is null and data is loaded', () => {
    expect(
      shouldNoindexRealEstateDetail({
        ...baseValid,
        totalCount: null,
      }),
    ).toBe(true)
  })

  it('does NOT noindex while data is still loading (avoid false positives during SSR)', () => {
    expect(
      shouldNoindexRealEstateDetail({
        buildingName: '래미안강남',
        loaded: false,
        hasBuildingInfo: false,
        totalCount: 0,
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

  it('noindexes at the totalCount < 10 boundary', () => {
    expect(
      shouldNoindexRealEstateDetail({ ...baseValid, totalCount: 10 }),
    ).toBe(false)
    expect(
      shouldNoindexRealEstateDetail({ ...baseValid, totalCount: 9 }),
    ).toBe(true)
  })
})
