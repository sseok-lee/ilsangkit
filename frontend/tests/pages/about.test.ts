import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import AboutPage from '~/pages/about.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn(), setHomeMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

const FACILITY_LABELS = [
  '공공화장실', '쓰레기 배출정보', '무료와이파이', '의류수거함', '공영주차장',
  '자동심장충격기(AED)', '공공도서관', '병원', '약국',
  '공원', '학교', '전통시장', '어린이집', '전기차 충전소', '체육시설',
]

describe('About Page', () => {
  it('renders the page title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.find('h1').text()).toContain('일상킷 소개')
  })

  it('lists all 15 facility categories', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    for (const label of FACILITY_LABELS) {
      expect(text, `expected about page to mention "${label}"`).toContain(label)
    }
  })

  it('does NOT mention the removed 무인민원발급기 category', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.text()).not.toContain('무인민원')
  })

  it('data-source section includes hospital, pharmacy and new categories', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    expect(text).toContain('병원정보서비스')
    expect(text).toContain('약국정보서비스')
    expect(text).toContain('도시공원')
    expect(text).toContain('전통시장')
    expect(text).toContain('체육시설')
  })
})
