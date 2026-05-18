import { describe, it, expect } from 'vitest'
import { shouldNoindexRealEstateDetail } from '~/utils/realEstateNoindex'

describe('shouldNoindexRealEstateDetail', () => {
  it('지번 패턴 buildingName은 noindex', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '123-45',
      loaded: true,
      hasBuildingInfo: true,
    })).toBe(true)
  })

  it('로드 전엔 false', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: false,
      hasBuildingInfo: false,
    })).toBe(false)
  })

  it('로드 완료 후 buildingInfo 없으면 noindex', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: true,
      hasBuildingInfo: false,
    })).toBe(true)
  })

  it('거래 0건이어도 buildingInfo가 있으면 색인(false)', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: true,
      hasBuildingInfo: true,
    })).toBe(false)
  })
})
