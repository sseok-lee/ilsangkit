import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, reactive, ref, watch, Suspense, type Ref } from 'vue'
import GuideIndex from '~/pages/guide/index.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), meta: vi.fn(), itemList: vi.fn(), ads: vi.fn() }))
vi.mock('~/composables/useGuides', () => ({ useGuides: () => ({ fetchGuides: mocks.fetch }) }))
vi.mock('~/composables/useFacilityMeta', () => ({ useFacilityMeta: () => ({ setMeta: mocks.meta }) }))
vi.mock('~/composables/useStructuredData', () => ({ useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setItemListSchema: mocks.itemList }) }))
vi.mock('~/composables/useAdsPolicy', () => ({ suppressAds: mocks.ads }))
vi.mock('~/composables/useAnalytics', () => ({ useAnalytics: () => ({ trackGuideListView: vi.fn() }) }))
const route = reactive({ query: {} as Record<string, string> })
const push = vi.fn(async ({ query }) => { route.query = query })
const articles = Array.from({ length: 13 }, (_, i) => ({ id: `${i + 1}`, slug: `guide-${i + 1}`, title: `안내 ${i + 1}`, summary: '이용 안내', category: i === 0 ? 'library' : 'parking', thumbnailUrl: null, publishedAt: '2026-09-23', createdAt: '2026-09-23', viewCount: 0 }))
let head: () => { meta: { content: string }[]; link: unknown[] }
const wrappers: ReturnType<typeof mount>[] = []

beforeEach(() => {
  wrappers.splice(0).forEach(w => w.unmount())
  vi.clearAllMocks(); route.query = {}
  mocks.fetch.mockImplementation(async ({ page }) => ({ items: articles.slice((page - 1) * 12, page * 12), total: 13, totalPages: 2, page }))
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push }))
  vi.stubGlobal('useHead', (value: typeof head) => { head = value })
  vi.stubGlobal('useAsyncData', async (key: Ref<string>, handler: () => Promise<unknown>) => {
    const data = ref<unknown>(null), error = ref<unknown>(null), status = ref('pending')
    let generation = 0
    async function refresh() {
      const current = ++generation
      data.value = null; error.value = null; status.value = 'pending'
      try { const result = await handler(); if (current === generation) { data.value = result; status.value = 'success' } }
      catch (err) { if (current === generation) { error.value = err; status.value = 'error' } }
    }
    watch(key, refresh); await refresh()
    return { data, error, status, refresh }
  })
})
async function render() {
  const wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(GuideIndex) }) }), { global: { stubs: { Breadcrumb: true, AdBanner: true } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}

describe('guide URL list and featured result', () => {
  it('shows twelve distinct results and features the first without dropping its schema', async () => {
    const wrapper = await render()
    const links = wrapper.findAll('a[href^="/guide/guide-"]')
    expect(links).toHaveLength(12)
    expect(new Set(links.map(link => link.attributes('href'))).size).toBe(12)
    expect(wrapper.text()).toContain('도서관')
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(mocks.itemList.mock.lastCall?.[0]).toHaveLength(12)
    expect(head().link).toHaveLength(1)
  })
  it('uses topic and page on the initial request and restores defaults on reset', async () => {
    route.query = { topic: 'parking', page: '2' }
    const wrapper = await render()
    expect(mocks.fetch).toHaveBeenCalledWith({ page: 2, limit: 12, categories: ['parking', 'ev-charger'] })
    expect(wrapper.findAll('a[href^="/guide/guide-"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('안내 13')
    expect(head().meta[0].content).toBe('noindex, follow'); expect(head().link).toEqual([])
    expect(mocks.ads).toHaveBeenLastCalledWith(true)
    await wrapper.findAll('button').find(b => b.text() === '전체')!.trigger('click'); await flushPromises()
    expect(route.query).toEqual({}); expect(head().link).toHaveLength(1)
    expect(mocks.ads).toHaveBeenLastCalledWith(false)
  })
  it('offers retry for a failed request rather than reporting zero results', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('offline'))
    const wrapper = await render()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('전체 0건')
    await wrapper.findAll('button').find(b => b.text() === '다시 시도')!.trigger('click'); await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('a[href^="/guide/guide-"]')).toHaveLength(12)
  })
  it('does not show old results while the new topic is pending', async () => {
    const wrapper = await render()
    let resolve!: (value: unknown) => void
    mocks.fetch.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await wrapper.findAll('button').find(b => b.text() === '주차·충전')!.trigger('click'); await flushPromises()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
    expect(wrapper.findAll('a[href^="/guide/guide-"]')).toHaveLength(0)
    resolve({ items: [], total: 0, page: 1, totalPages: 1 }); await flushPromises()
    expect(wrapper.text()).toContain('전체 0건')
  })
})
