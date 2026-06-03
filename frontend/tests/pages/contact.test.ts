import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import ContactPage from '~/pages/contact.vue'
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

describe('Contact Page', () => {
  it('renders the title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.find('h1').text()).toContain('문의하기')
  })

  it('renders the contact email', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).toContain('contact@ilsangkit.co.kr')
  })

  it('does NOT show an update badge (info page, not legal)', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).not.toContain('마지막 업데이트')
  })
})
