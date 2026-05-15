import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import FacilityYoutubeSection from '~/components/facility/youtube/FacilityYoutubeSection.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
  // happy-dom has no IntersectionObserver — stub so component invokes callback immediately
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

const props = { category: 'parking' as const, facilityId: '123' }

describe('FacilityYoutubeSection', () => {
  it('영상이 0~1건이면 헤더/카드를 렌더링하지 않는다 (sentinel만 남음)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }] } })
    const w = mount(FacilityYoutubeSection, { props })
    await flushPromises(); await nextTick()
    // sentinel section은 IntersectionObserver를 위해 항상 존재
    expect(w.find('[data-testid="yt-section"]').exists()).toBe(true)
    // 단, 결과 부족 시 내용은 렌더링 안 됨
    expect(w.find('h2').exists()).toBe(false)
    expect(w.findAll('[data-testid="yt-card"]')).toHaveLength(0)
  })

  it('영상이 2건 이상이면 카드 N개를 렌더링한다 (최대 6)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: Array.from({ length: 8 }, (_, i) => ({ videoId: `v${i}`, title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' })) } })
    const w = mount(FacilityYoutubeSection, { props })
    await flushPromises(); await nextTick()
    expect(w.findAll('[data-testid="yt-card"]')).toHaveLength(6)
  })

  it('카드 클릭 시 모달이 열린다', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: Array.from({ length: 2 }, (_, i) => ({ videoId: `v${i}`, title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' })) } })
    const w = mount(FacilityYoutubeSection, { props, attachTo: document.body })
    await flushPromises(); await nextTick()
    await w.findAll('[data-testid="yt-card"]')[0].trigger('click')
    expect(document.body.querySelector('iframe')).not.toBeNull()
  })
})
