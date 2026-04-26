import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// Stub Vue auto-imports
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// Mock createError (Nuxt global)
;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

// Mock useRoute with valid propertyType param
;(globalThis as any).useRoute = vi.fn(() => ({
  params: { propertyType: 'apt' },
  query: {},
}))

// Mock useRouter
;(globalThis as any).useRouter = vi.fn(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getComplexList: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
    }),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/realEstateBuildingName', () => ({
  isValidBuildingName: vi.fn(() => true),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
})

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          PageHero: { template: '<div data-stub="hero" />' },
          SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: { template: '<div />' },
          TransactionModeTab: { template: '<div />' },
          RealEstateSearchFilter: { template: '<div />' },
          ComplexCard: { template: '<div />' },
          Pagination: { template: '<div />' },
          DataSourceCard: { template: '<div />' },
        },
        ...options?.global,
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/[propertyType]/index.vue — property type list page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/[propertyType]/index.vue')
    expect(m.default).toBeDefined()
  })

  it('setItemListSchema가 호출되어야 한다 (ItemList 구조화 데이터)', async () => {
    const m = await import('~/pages/real-estate/[propertyType]/index.vue')
    await mountSuspended(m.default)
    expect(mockSetItemListSchema).toHaveBeenCalled()
  })
})
