import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// Override useAsyncData to actually call the fetcher so hub data is populated
;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => unknown) => {
  let value: unknown = null
  try {
    value = await fetcher()
  } catch {
    value = null
  }
  const data = ref(value)
  return Object.assign(Promise.resolve({ data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }), {
    data,
    status: ref('success'),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(false),
  })
})

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useLand', () => ({
  useLand: () => ({
    getHubSummary: async () => ({
      cities: [
        {
          slug: 'seoul',
          city: '서울특별시',
          indexableDongCount: 10,
          totalTransactions: 500,
        },
      ],
      totalTransactions: 500,
    }),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
})

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
}

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/land/index.vue — land hub page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/land/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setBreadcrumbSchema가 /real-estate/land를 마지막 크럼으로 호출되어야 한다', async () => {
    const m = await import('~/pages/real-estate/land/index.vue')
    await mountSuspended(m.default)
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    const lastCrumb = crumbs[crumbs.length - 1]
    expect(lastCrumb.url).toBe('/real-estate/land')
  })

  it('setItemListSchema가 /real-estate/land/ 로 시작하는 URL을 포함하여 호출되어야 한다', async () => {
    const m = await import('~/pages/real-estate/land/index.vue')
    await mountSuspended(m.default)
    expect(mockSetItemListSchema).toHaveBeenCalled()
    const items = mockSetItemListSchema.mock.calls[0][0]
    expect(items.length).toBeGreaterThan(0)
    const urls: string[] = items.map((i: any) => i.url)
    expect(urls.some((u) => u.startsWith('/real-estate/land/'))).toBe(true)
  })
})
