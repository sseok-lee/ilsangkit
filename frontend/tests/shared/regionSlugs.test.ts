import { describe, it, expect } from 'vitest'
import { buildTrashRegionPath } from '~/shared/regionSlugs'

describe('shared buildTrashRegionPath', () => {
  it('정식 도명 → 슬러그 (라이브 검증값)', () => {
    expect(buildTrashRegionPath('경기도', '가평군')).toBe('/gyeonggi/gapyeong/trash') // 2-A 라이브 확인값
    expect(buildTrashRegionPath('서울특별시', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('축약 도명', () => {
    expect(buildTrashRegionPath('서울', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('미해결 도시는 null', () => {
    expect(buildTrashRegionPath('없는도시', '강남구')).toBeNull()
  })
  it('정식 도명(충청북도) + 매핑된 district', () => {
    expect(buildTrashRegionPath('충청북도', '청주시')).toBe('/chungbuk/cheongju/trash')
  })
  it('정식 도명(경상북도) + 매핑된 district', () => {
    expect(buildTrashRegionPath('경상북도', '경주시')).toBe('/gyeongbuk/gyeongju/trash')
  })
})
