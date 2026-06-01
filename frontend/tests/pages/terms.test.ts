import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import TermsPage from '~/pages/terms.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

describe('Terms Page', () => {
  it('lists the new facility categories in 제2조', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()
    for (const label of ['공원', '학교', '전통시장', '어린이집', '전기차 충전소', '체육시설']) {
      expect(text, `expected terms 제2조 to include "${label}"`).toContain(label)
    }
  })

  it('does NOT mention 무인민원발급기', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).not.toContain('무인민원')
  })

  it('keeps the original effective date 2026년 3월 14일', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).toContain('2026년 3월 14일')
  })

  it('shows the last-updated badge 2026.06.01', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })
})
