import { describe, it, expect, vi } from 'vitest'
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
;(globalThis as any).createError = (opts: any) => { const e = new Error(opts.statusMessage); (e as any).statusCode = opts.statusCode; return e }

// Mock useRoute
;(globalThis as any).useRoute = vi.fn(() => ({
  params: { city: 'seoul', district: 'gangnam' },
}))

// Mock useRegions
vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    loadRegions: vi.fn().mockResolvedValue([]),
    syncFromHydration: vi.fn(),
    getCityName: vi.fn(() => '서울'),
    getDistrictName: vi.fn(() => '강남구'),
    getDistrictsByCity: vi.fn(() => [{ slug: 'gangnam', name: '강남구' }]),
  }),
  CITY_SLUG_MAP: { seoul: '서울' },
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    options,
  )
  await flushPromises()
  return wrapper
}

describe('지역+부동산 교차 페이지 (Task 4.1)', () => {
  it('페이지 컴포넌트가 export default를 가져야 한다 (import 가능 여부)', async () => {
    const module = await import('~/pages/[city]/[district]/real-estate.vue')
    expect(module.default).toBeDefined()
  })

  it('REAL_ESTATE_FAQS 데이터에 4개 이상 FAQ 항목이 존재해야 한다', async () => {
    const module = await import('~/pages/[city]/[district]/real-estate.vue')
    // Access the exported FAQ data or verify by rendering
    const wrapper = await mountSuspended(module.default)
    const detailsElements = wrapper.findAll('details')
    expect(detailsElements.length).toBeGreaterThanOrEqual(4)
  })

  it('각 FAQ에 question과 answer가 있어야 한다', async () => {
    const module = await import('~/pages/[city]/[district]/real-estate.vue')
    const wrapper = await mountSuspended(module.default)
    const summaries = wrapper.findAll('summary')
    const answers = wrapper.findAll('details p')
    expect(summaries.length).toBeGreaterThanOrEqual(4)
    expect(answers.length).toBeGreaterThanOrEqual(4)
    summaries.forEach((s) => {
      expect(s.text().trim().length).toBeGreaterThan(0)
    })
    answers.forEach((a) => {
      expect(a.text().trim().length).toBeGreaterThan(0)
    })
  })

  it('H1 태그에 부동산 실거래가 텍스트가 포함되어야 한다', async () => {
    const module = await import('~/pages/[city]/[district]/real-estate.vue')
    const wrapper = await mountSuspended(module.default)
    const h1 = wrapper.find('h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toContain('부동산 실거래가')
  })

  it('유형별 링크 섹션이 존재해야 한다', async () => {
    const module = await import('~/pages/[city]/[district]/real-estate.vue')
    const wrapper = await mountSuspended(module.default)
    const h2Elements = wrapper.findAll('h2')
    const texts = h2Elements.map(el => el.text())
    expect(texts.some(t => t.includes('유형별'))).toBe(true)
  })
})
