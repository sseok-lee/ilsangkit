import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import RealEstateHubPage from '~/pages/real-estate/index.vue'

// Stub Vue auto-imports
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
  }),
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
    options,
  )
  await flushPromises()
  return wrapper
}

describe('부동산 허브 페이지 콘텐츠 강화 (Task 3.3)', () => {
  it('H2 요소가 3개 이상 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const h2Elements = wrapper.findAll('h2')
    expect(h2Elements.length).toBeGreaterThanOrEqual(3)
  })

  it('"자주 묻는 질문" 텍스트가 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    expect(wrapper.text()).toContain('자주 묻는 질문')
  })

  it('<details> 요소가 존재해야 한다 (FAQ 아코디언)', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const detailsElements = wrapper.findAll('details')
    expect(detailsElements.length).toBeGreaterThan(0)
  })

  it('<summary> 요소가 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const summaryElements = wrapper.findAll('summary')
    expect(summaryElements.length).toBeGreaterThan(0)
  })

  it('"부동산 유형별 실거래가" 섹션 H2가 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const h2Elements = wrapper.findAll('h2')
    const texts = h2Elements.map(el => el.text())
    expect(texts.some(t => t.includes('부동산 유형별') || t.includes('실거래가'))).toBe(true)
  })

  it('"부동산 실거래가란?" H2 섹션이 존재해야 한다', async () => {
    const wrapper = await mountSuspended(RealEstateHubPage)
    const h2Elements = wrapper.findAll('h2')
    const texts = h2Elements.map(el => el.text())
    expect(texts.some(t => t.includes('부동산 실거래가란'))).toBe(true)
  })

  it('setItemListSchema가 호출되어야 한다 (ItemList 구조화 데이터)', async () => {
    await mountSuspended(RealEstateHubPage)
    expect(mockSetItemListSchema).toHaveBeenCalled()
  })

})
