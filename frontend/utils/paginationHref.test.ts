import { describe, it, expect } from 'vitest'
import { buildPageHref } from './paginationHref'

// Pagination 이 <a href> 로 렌더될 때 쓰는 URL 생성기.
// 기존 syncPageQuery(페이지 1 이면 page 키 자체를 제거) 와 동일한 의미론을 문자열 URL 로 낸다.
// href 와 클릭 후 SPA 가 만드는 URL 이 어긋나면 크롤러가 보는 페이지와 사용자가 보는 페이지가 갈라진다.

describe('buildPageHref', () => {
  it('page 1 은 page 파라미터를 붙이지 않는다 (canonical URL 과 동일하게 유지)', () => {
    expect(buildPageHref('/hospital', {}, 1)).toBe('/hospital')
  })

  it('page 2 이상은 ?page=N 을 붙인다', () => {
    expect(buildPageHref('/hospital', {}, 2)).toBe('/hospital?page=2')
  })

  it('기존 쿼리를 보존하고 page 는 마지막에 붙인다', () => {
    expect(buildPageHref('/hospital', { city: 'seoul' }, 3)).toBe('/hospital?city=seoul&page=3')
  })

  it('기존 쿼리에 있던 page 는 새 값으로 대체한다', () => {
    expect(buildPageHref('/hospital', { page: '7', city: 'seoul' }, 2)).toBe(
      '/hospital?city=seoul&page=2',
    )
  })

  it('page 1 이면 기존 page 쿼리를 제거한다', () => {
    expect(buildPageHref('/hospital', { page: '7', city: 'seoul' }, 1)).toBe('/hospital?city=seoul')
  })

  it('빈 문자열·undefined·null 쿼리는 URL 에 넣지 않는다', () => {
    expect(buildPageHref('/hospital', { city: '', keyword: undefined, q: null }, 2)).toBe(
      '/hospital?page=2',
    )
  })

  it('한글 등은 퍼센트 인코딩한다', () => {
    expect(buildPageHref('/hospital', { keyword: '역삼' }, 2)).toBe(
      '/hospital?keyword=%EC%97%AD%EC%82%BC&page=2',
    )
  })

  it('배열 쿼리는 첫 값만 쓴다 (route.query 는 배열일 수 있다)', () => {
    expect(buildPageHref('/hospital', { city: ['seoul', 'busan'] }, 2)).toBe(
      '/hospital?city=seoul&page=2',
    )
  })

  it('0 이나 음수는 page 1 로 취급한다', () => {
    expect(buildPageHref('/hospital', {}, 0)).toBe('/hospital')
    expect(buildPageHref('/hospital', {}, -3)).toBe('/hospital')
  })

  it('경로에 이미 붙은 쿼리스트링은 무시하고 path 부분만 쓴다', () => {
    expect(buildPageHref('/hospital?page=9', { city: 'seoul' }, 2)).toBe(
      '/hospital?city=seoul&page=2',
    )
  })
})
