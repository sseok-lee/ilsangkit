import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import PrivacyPage from '~/pages/privacy.vue'
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

describe('Privacy Page', () => {
  it('renders the title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.find('h1').text()).toContain('개인정보처리방침')
  })

  it('shows the last-updated badge 2026.06.01', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })

  it('keeps the original effective date 2026년 3월 14일', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.text()).toContain('2026년 3월 14일')
  })
})
