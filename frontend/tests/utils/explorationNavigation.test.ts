import { describe, expect, it } from 'vitest'
import { explorationListHref } from '~/utils/explorationNavigation'

describe('explorationListHref', () => {
  it('명시적 지역이 없으면 유형 전국 목록으로 보낸다', () => {
    expect(explorationListHref('apt-sale', null)).toBe('/real-estate/apt-sale')
  })

  it('시/도만 명시되면 시/도 목록으로 보낸다', () => {
    expect(explorationListHref('villa-rent', { city: '서울' })).toBe('/real-estate/villa-rent/seoul')
  })

  it('시/도와 구/군이 명시되면 기존 목록 URL 유틸 결과를 쓴다', () => {
    expect(explorationListHref('offitel-sale', { city: '서울', district: '강남구' }))
      .toBe('/real-estate/offitel-sale/seoul/gangnam')
  })

  it('전남광주통합특별시 slug 규칙을 기존 유틸과 동일하게 따른다', () => {
    expect(explorationListHref('apt-rent', { city: '전남광주통합특별시', district: '광산구' }))
      .toBe('/real-estate/apt-rent/jeonnamgwangju/gwangsan')
  })
})
