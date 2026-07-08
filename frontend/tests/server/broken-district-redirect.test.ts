import { describe, it, expect } from 'vitest'
import { resolveBrokenDistrictRedirect } from '~/server/middleware/real-estate-redirect'

/**
 * 화성·부천 신설 구 slug 드리프트로 과거 색인·IndexNow 에 유출된 깨진 지역 슬러그의
 * 정본 301 매핑 검증. (근본 원인은 backend lib 맵 동기화로 별도 수정)
 */
describe('resolveBrokenDistrictRedirect', () => {
  it('로마자-한글 혼합 슬러그(hwaseong-효행구)를 정본으로 치환한다', () => {
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale/gyeonggi/hwaseong-효행구'))
      .toBe('/real-estate/apt-sale/gyeonggi/hwaseong-hyohaeng')
  })

  it('전-한글 슬러그(화성시-효행구, IndexNow 제출본)를 정본으로 치환한다', () => {
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale/gyeonggi/화성시-효행구'))
      .toBe('/real-estate/apt-sale/gyeonggi/hwaseong-hyohaeng')
  })

  it('URL 인코딩된 세그먼트도 디코드해 매칭한다', () => {
    const encoded = `/real-estate/villa-rent/gyeonggi/${encodeURIComponent('bucheon-소사구')}`
    expect(resolveBrokenDistrictRedirect(encoded))
      .toBe('/real-estate/villa-rent/gyeonggi/bucheon-sosa')
  })

  it('건물명이 붙은 상세 URL 도 district 세그먼트만 치환한다', () => {
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale/gyeonggi/hwaseong-동탄구/롯데캐슬'))
      .toBe('/real-estate/apt-sale/gyeonggi/hwaseong-dongtan/롯데캐슬')
  })

  it('부천 3구·화성 4구 전부 매핑된다', () => {
    const cases: [string, string][] = [
      ['hwaseong-만세구', 'hwaseong-manse'],
      ['hwaseong-병점구', 'hwaseong-byeongjeom'],
      ['bucheon-오정구', 'bucheon-ojeong'],
      ['bucheon-원미구', 'bucheon-wonmi'],
    ]
    for (const [broken, canonical] of cases) {
      expect(resolveBrokenDistrictRedirect(`/real-estate/apt-sale/gyeonggi/${broken}`))
        .toBe(`/real-estate/apt-sale/gyeonggi/${canonical}`)
    }
  })

  it('정상 슬러그·비대상 경로는 null 을 반환한다 (리다이렉트 없음)', () => {
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale/gyeonggi/hwaseong-hyohaeng')).toBeNull()
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale/seoul/gangnam')).toBeNull()
    expect(resolveBrokenDistrictRedirect('/guide/some-post')).toBeNull()
    expect(resolveBrokenDistrictRedirect('/real-estate/apt-sale')).toBeNull()
  })
})
