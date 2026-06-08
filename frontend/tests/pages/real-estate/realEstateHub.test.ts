import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

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

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/dataSource', () => ({
  REAL_ESTATE_DATA_SOURCE: { name: '국토교통부', url: 'https://rtms.molit.go.kr' },
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
  RealEstateCategoryCards: { template: '<div />' },
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

describe('real-estate/index.vue — hub page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setItemListSchema가 canonical realEstateType URL로 호출되어야 한다', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    expect(mockSetItemListSchema).toHaveBeenCalled()
    const items = mockSetItemListSchema.mock.calls[0][0]
    const urls = items.map((i: any) => i.url)
    expect(urls).toContain('/real-estate/apt-sale')
    expect(urls).toContain('/real-estate/apt-rent')
    expect(urls).toContain('/real-estate/villa-sale')
    expect(urls).toContain('/real-estate/villa-rent')
    expect(urls).toContain('/real-estate/offitel-sale')
    expect(urls).toContain('/real-estate/offitel-rent')
    expect(urls).toContain('/real-estate/land')
  })

  it('setItemListSchema가 레거시 hub URL을 포함하지 않아야 한다', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    const items = mockSetItemListSchema.mock.calls[0][0]
    const urls = items.map((i: any) => i.url)
    expect(urls).not.toContain('/real-estate/apt')
    expect(urls).not.toContain('/real-estate/villa')
    expect(urls).not.toContain('/real-estate/offitel')
  })

  it('setItemListSchema 항목이 7개여야 한다 (매매+전월세 × 3 주택유형 + 토지)', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    const items = mockSetItemListSchema.mock.calls[0][0]
    expect(items).toHaveLength(7)
  })
})
