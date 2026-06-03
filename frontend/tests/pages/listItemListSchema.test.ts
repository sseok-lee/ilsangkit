import { ref } from 'vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import GuideIndex from '~/pages/guide/index.vue'

const setItemListSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setItemListSchema }),
}))
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
  const data = ref<any>({ items: [
    { id: 1, slug: 'a', title: '가이드 A', category: 'apt-sale', summary: '', thumbnailUrl: null, createdAt: '2026-01-01', viewCount: 0 },
    { id: 2, slug: 'b', title: '가이드 B', category: 'apt-sale', summary: '', thumbnailUrl: null, createdAt: '2026-01-01', viewCount: 0 },
  ] })
  const status = ref('success')
  return Object.assign(Promise.resolve({ data, status }), { data, status, pending: ref(false), error: ref(null), refresh: vi.fn() })
})

const stubs = { NuxtLink: { template: '<a><slot /></a>', props: ['to'] }, Breadcrumb: true, PageHero: true, SectionBlock: { template: '<section><slot /></section>' }, AdBanner: true, Pagination: true }

async function mountSuspended(c: any) {
  const w = mount(defineComponent({ render() { return h(Suspense, null, { default: () => h(c) }) } }), { global: { stubs } })
  await flushPromises()
  return w
}
beforeEach(() => vi.clearAllMocks())

describe('guide 목록 ItemList 스키마', () => {
  it('가이드 목록을 ItemList로 연결한다', async () => {
    await mountSuspended(GuideIndex)
    expect(setItemListSchema).toHaveBeenCalledWith([
      { name: '가이드 A', url: '/guide/a', position: 1 },
      { name: '가이드 B', url: '/guide/b', position: 2 },
    ])
  })
})
