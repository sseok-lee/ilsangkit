import { describe, it, expect } from 'vitest'
import { computeAreaNoindex } from '~/utils/areaNoindex'

describe('computeAreaNoindex', () => {
  it('비-trash: summary.count 0이면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 0, wasteEmpty: false, page: 1 })).toBe(true)
  })
  it('비-trash: summary.count>0이면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('비-trash: summary 미확보(undefined)면 indexable(보수적)', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('page>1이면 항상 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 2 })).toBe(true)
  })
  it('trash: wasteEmpty true면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: true, page: 1 })).toBe(true)
  })
  it('trash: wasteEmpty false면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
})

// G(b) 회귀 방지: noindex 페이지에 rel=prev/next 를 내보내면 안 된다.
// [city]/[district]/[category].vue 의 isPageNoindex 게이팅 로직을 시뮬레이션.
describe('G(b) — noindex 페이지에서 rel=prev/next 억제', () => {
  /**
   * 페이지 컴포넌트의 watch 블록 동작을 단위 수준에서 재현:
   * isPageNoindex 가 true 일 때 paginationLinks 를 빈 배열로 유지해야 한다.
   */
  function buildPaginationLinks(
    isPageNoindex: boolean,
    currentPage: number,
    totalPages: number,
    baseUrl: string,
  ): Array<{ rel: string; href: string }> {
    if (isPageNoindex) return []
    const links: Array<{ rel: string; href: string }> = []
    if (currentPage > 1) links.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage - 1}` })
    if (currentPage < totalPages) links.push({ rel: 'next', href: `${baseUrl}?page=${currentPage + 1}` })
    return links
  }

  const base = 'https://ilsangkit.co.kr/seoul/gangnam/toilet'

  it('noindex=true(page 2) 이면 prev/next 링크를 반환하지 않는다', () => {
    const isNoindex = computeAreaNoindex({ isTrash: false, summaryCount: 50, wasteEmpty: false, page: 2 })
    expect(isNoindex).toBe(true)
    const links = buildPaginationLinks(isNoindex, 2, 5, base)
    expect(links).toHaveLength(0)
  })

  it('noindex=true(summary 0) 이면 링크를 반환하지 않는다', () => {
    const isNoindex = computeAreaNoindex({ isTrash: false, summaryCount: 0, wasteEmpty: false, page: 1 })
    expect(isNoindex).toBe(true)
    const links = buildPaginationLinks(isNoindex, 1, 3, base)
    expect(links).toHaveLength(0)
  })

  it('noindex=false(page 1, count>0) 이면 next 링크를 반환한다', () => {
    const isNoindex = computeAreaNoindex({ isTrash: false, summaryCount: 50, wasteEmpty: false, page: 1 })
    expect(isNoindex).toBe(false)
    const links = buildPaginationLinks(isNoindex, 1, 3, base)
    expect(links.some(l => l.rel === 'next')).toBe(true)
    expect(links.some(l => l.rel === 'prev')).toBe(false)
  })

  it('noindex=true(trash 비어있음) 이면 링크를 반환하지 않는다', () => {
    const isNoindex = computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: true, page: 1 })
    expect(isNoindex).toBe(true)
    const links = buildPaginationLinks(isNoindex, 1, 2, base)
    expect(links).toHaveLength(0)
  })

  // /search 는 항상 noindex 이므로 prev/next 를 절대 내보내지 않아야 한다.
  it('/search 페이지 — 항상 noindex 이므로 prev/next 링크 없음', () => {
    const searchIsAlwaysNoindex = true
    const links = buildPaginationLinks(searchIsAlwaysNoindex, 2, 5, 'https://ilsangkit.co.kr/search')
    expect(links).toHaveLength(0)
  })
})
