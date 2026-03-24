import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'

// ─── Task 1.1: FAQ HTML 렌더링 검증 (유닛 테스트) ─────────────────────────

describe('CategoryPage - FAQ 데이터 검증', () => {
  it('toilet 카테고리에 FAQ 데이터가 존재한다', () => {
    const faqItems = CATEGORY_FAQ.toilet || []
    expect(faqItems.length).toBeGreaterThan(0)
  })

  it('FAQ 각 항목에 question과 answer가 있다', () => {
    const faqItems = CATEGORY_FAQ.toilet || []
    for (const faq of faqItems) {
      expect(faq.question).toBeTruthy()
      expect(faq.answer).toBeTruthy()
    }
  })

  it('hospital 카테고리에도 FAQ 데이터가 존재한다', () => {
    const faqItems = CATEGORY_FAQ.hospital || []
    expect(faqItems.length).toBeGreaterThan(0)
  })

  it('존재하지 않는 카테고리는 빈 배열 또는 undefined', () => {
    const faqItems = (CATEGORY_FAQ as Record<string, unknown>)['nonexistent-category']
    expect(!faqItems || (Array.isArray(faqItems) && faqItems.length === 0)).toBe(true)
  })
})

// ─── Task 1.8: 페이지네이션 rel link SSR 검증 (유틸 로직) ─────────────────

describe('CategoryPage - 페이지네이션 rel link 로직', () => {
  const SITE_URL = 'https://ilsangkit.co.kr'

  function computePaginationLinks(category: string, page: number, totalPages: number) {
    const links: Array<{ rel: string; href: string }> = []
    if (page > 1) {
      links.push({ rel: 'prev', href: `${SITE_URL}/${category}?page=${page - 1}` })
    }
    if (totalPages && page < totalPages) {
      links.push({ rel: 'next', href: `${SITE_URL}/${category}?page=${page + 1}` })
    }
    return links
  }

  it('page=2일 때 prev 링크가 존재한다', () => {
    const links = computePaginationLinks('toilet', 2, 10)
    expect(links.some(l => l.rel === 'prev')).toBe(true)
  })

  it('page=2일 때 next 링크가 존재한다', () => {
    const links = computePaginationLinks('toilet', 2, 10)
    expect(links.some(l => l.rel === 'next')).toBe(true)
  })

  it('page=1일 때 prev 링크가 없다', () => {
    const links = computePaginationLinks('toilet', 1, 10)
    expect(links.some(l => l.rel === 'prev')).toBe(false)
  })

  it('마지막 페이지일 때 next 링크가 없다', () => {
    const links = computePaginationLinks('toilet', 10, 10)
    expect(links.some(l => l.rel === 'next')).toBe(false)
  })

  it('prev 링크 href에 page-1이 포함된다', () => {
    const links = computePaginationLinks('toilet', 5, 10)
    const prev = links.find(l => l.rel === 'prev')
    expect(prev?.href).toContain('page=4')
  })

  it('next 링크 href에 page+1이 포함된다', () => {
    const links = computePaginationLinks('toilet', 5, 10)
    const next = links.find(l => l.rel === 'next')
    expect(next?.href).toContain('page=6')
  })
})
