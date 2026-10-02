import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import FaqPage from '~/pages/faq.vue'

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
  it('PageHead로 제목을 렌더한다', async () => {
    const wrapper = await mountSuspended(FaqPage)
    expect(wrapper.find('h1').text()).toContain('자주 묻는 질문')
  })

  it('주제 탭은 세그먼트(라디오)이고 질문 주제 nav 안에 있다', async () => {
    const wrapper = await mountSuspended(FaqPage)
    const nav = wrapper.get('nav[aria-label="질문 주제"]')
    const radios = nav.findAll('[role="radio"]')
    expect(radios.map((r) => r.text())).toEqual(['전체', '부동산', '생활시설'])
    expect(radios[0].attributes('aria-checked')).toBe('true')
    await radios[2].trigger('click')
    expect(radios[2].attributes('aria-checked')).toBe('true')
  })

  it('h2·h3 제목 텍스트에 아이콘 글자가 섞이지 않는다', async () => {
    const wrapper = await mountSuspended(FaqPage)
    for (const h of wrapper.findAll('h2, h3')) {
      expect(h.find('.material-symbols-outlined').exists()).toBe(false)
    }
  })

  it('정렬 컨테이너 + 760px 읽기 칼럼, 1040px·font-display·:deep 없음', () => {
    const src = readFileSync(resolve(__dirname, '../../pages/faq.vue'), 'utf8')
    expect(src).toContain('page-container')
    expect(src).toContain('max-w-[760px]')
    expect(src).not.toContain('max-w-[1040px]')
    expect(src).not.toContain('font-display')
    expect(src).not.toMatch(/:deep\(/)
    expect(src).not.toContain('StaticPageHeader')
  })
})
