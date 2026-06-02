import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

const setFAQSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema,
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/dataSource', () => ({
  REAL_ESTATE_DATA_SOURCE: { name: '국토교통부', url: 'https://rtms.molit.go.kr' },
}))

beforeEach(() => vi.clearAllMocks())

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div />' },
  RealEstateCategoryCards: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
}

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate 허브 FAQ 스키마', () => {
  it('가시 FAQ를 setFAQSchema로 연결한다(question/answer 형태)', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    expect(setFAQSchema).toHaveBeenCalled()
    const arg = setFAQSchema.mock.calls[0][0]
    expect(Array.isArray(arg)).toBe(true)
    expect(arg.length).toBeGreaterThan(0)
    expect(arg[0]).toHaveProperty('question')
    expect(arg[0]).toHaveProperty('answer')
  })
})
