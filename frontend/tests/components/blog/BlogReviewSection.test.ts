import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
  class IO {
    cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback) { this.cb = cb }
    observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver) }
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds = []
  }
  vi.stubGlobal('IntersectionObserver', IO as unknown as typeof IntersectionObserver)
})

function mkPosts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    url: `u${i}`, title: 't'+i, description: 'd'.repeat(40),
    bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101',
  }))
}

describe('BlogReviewSection', () => {
  it('결과 0~2건이면 콘텐츠 미렌더 (sentinel은 남음)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(2) } })
    const w = mount(BlogReviewSection, { props: { kind: 'facility' as const, primaryKey: 'parking', secondaryKey: '123' } })
    await flushPromises(); await nextTick()
    expect(w.find('[data-testid="blog-section"]').exists()).toBe(true)
    expect(w.find('h2').exists()).toBe(false)
    expect(w.findAll('[data-testid="blog-card"]')).toHaveLength(0)
  })

  it('3건 이상이면 카드 N개 (최대 5)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(8) } })
    const w = mount(BlogReviewSection, { props: { kind: 'facility' as const, primaryKey: 'parking', secondaryKey: '123' } })
    await flushPromises(); await nextTick()
    expect(w.findAll('[data-testid="blog-card"]')).toHaveLength(5)
    expect(w.find('h2').text()).toContain('관련 블로그')
  })

  it('kind=real-estate 경로 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(3) } })
    mount(BlogReviewSection, { props: { kind: 'real-estate' as const, primaryKey: 'apt-sale', secondaryKey: '서울특별시|종로구|롯데캐슬 골드' } })
    await flushPromises(); await nextTick()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/real-estate/apt-sale/'))
  })
})
