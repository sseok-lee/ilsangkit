import { describe, it, expect } from 'vitest'
import { buildTrashRegionPath } from '~/utils/trashRegion'

describe('buildTrashRegionPath', () => {
  it('정식 시도명 + 구명을 슬러그 경로로 변환', () => {
    expect(buildTrashRegionPath('서울특별시', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('축약 시도명도 매핑된다', () => {
    expect(buildTrashRegionPath('서울', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('알 수 없는 도시는 null', () => {
    expect(buildTrashRegionPath('없는도시', '강남구')).toBeNull()
  })
  it('정식 도명(충청북도)을 슬러그로 변환', () => {
    expect(buildTrashRegionPath('충청북도', '청주시')).toBe('/chungbuk/cheongju/trash')
  })
  it('정식 도명(경상북도)을 슬러그로 변환', () => {
    expect(buildTrashRegionPath('경상북도', '경주시')).toBe('/gyeongbuk/gyeongju/trash')
  })
})
