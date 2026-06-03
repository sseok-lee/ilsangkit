import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import FaqPage from '~/pages/faq.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    {
      global: {
        components: { StaticPageHeader },
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          AdBanner: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('FAQ Page', () => {
  it('StaticPageHeader로 제목을 렌더한다', async () => {
    const wrapper = await mountSuspended(FaqPage)
    expect(wrapper.find('h1').text()).toContain('자주 묻는 질문')
  })
})
