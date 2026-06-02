import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))

// 기본 setup 모킹은 data:null을 반환하므로, 핸들러를 실제 실행하도록 오버라이드
vi.stubGlobal('useAsyncData', (_key: string, handler: () => Promise<unknown>, opts?: { default?: () => unknown }) => {
  const data = ref<unknown>(opts?.default ? opts.default() : null)
  const error = ref<unknown>(null)
  const result = { data, pending: ref(false), error, refresh: vi.fn() }
  const p = handler()
    .then((r) => { data.value = r; return result })
    .catch((e) => { error.value = e; return result })
  return Object.assign(p, result)
})

const stubs = { NuxtLink: { template: '<a><slot /></a>', props: ['to'] } }
const item = (id: number, slug: string, title: string) => ({
  id, slug, title, summary: '요약', category: 'hospital', thumbnailUrl: null,
})

// async setup이므로 Suspense 래퍼 필요
function mountWithSuspense(props: Record<string, unknown>) {
  const Wrapper = defineComponent({
    render() {
      return h(Suspense, {}, {
        default: () => h(RelatedGuides, props),
      })
    },
  })
  return mount(Wrapper, { global: { stubs } })
}

beforeEach(() => vi.clearAllMocks())

describe('RelatedGuides', () => {
  it('SSR 데이터의 가이드 링크를 렌더링한다', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { items: [item(1, 'a', '가이드 A'), item(2, 'b', '가이드 B')] } })
    const wrapper = mountWithSuspense({ category: 'hospital' })
    await flushPromises()
    expect(wrapper.text()).toContain('가이드 A')
    expect(wrapper.text()).toContain('가이드 B')
  })

  it('가이드가 없으면 섹션을 렌더링하지 않는다', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { items: [] } })
    const wrapper = mountWithSuspense({ category: 'hospital' })
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('API 오류 시 섹션을 렌더링하지 않는다', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const wrapper = mountWithSuspense({ category: 'hospital' })
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('excludeSlug 제외 후 limit만큼만 렌더링한다', async () => {
    mockFetch.mockResolvedValue({
      success: true,
      data: {
        items: [
          item(1, 'a', '가이드 A'),
          item(2, 'b', '가이드 B'),
          item(3, 'c', '가이드 C'),
          item(4, 'd', '가이드 D'),
        ],
      },
    })
    const wrapper = mountWithSuspense({ category: 'hospital', excludeSlug: 'a', limit: 3 })
    await flushPromises()
    expect(wrapper.text()).not.toContain('가이드 A')
    expect(wrapper.text()).toContain('가이드 B')
    expect(wrapper.text()).toContain('가이드 C')
    expect(wrapper.text()).toContain('가이드 D')
  })
})
