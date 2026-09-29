import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Privacy from '~/pages/privacy.vue'
import Terms from '~/pages/terms.vue'
import Contact from '~/pages/contact.vue'
import Faq from '~/pages/faq.vue'
import original from '../fixtures/legal-original-text.json'
import { CATEGORY_GROUPS } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { REAL_ESTATE_FAQ } from '~/utils/realEstateMeta'

const schema = vi.hoisted(() => vi.fn())
vi.mock('~/composables/useFacilityMeta', () => ({ useFacilityMeta: () => ({ setMeta: vi.fn() }) }))
vi.mock('~/composables/useStructuredData', () => ({ useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setFAQSchema: schema }) }))
const normalize = (text: string) => text.replace(/\s+/g, '')
const stubs = { StaticPageHeader: true, AdBanner: true }

describe('editorial original information preservation', () => {
  it.each([['privacy', Privacy], ['terms', Terms]] as const)('preserves %s clause text and order', (kind, component) => {
    const wrapper = mount(component, { global: { stubs } })
    expect(wrapper.findAll('section').map(section => normalize(section.text()))).toEqual(original[kind].map(normalize))
  })
  it('preserves real email and provides no network submission form', () => {
    const wrapper = mount(Contact, { global: { stubs } })
    expect(wrapper.find('a[href="mailto:contact@ilsangkit.co.kr"]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it('keeps existing FAQ questions and answers in both full view and schema', () => {
    const wrapper = mount(Faq, { global: { stubs } })
    const realEstate = [...REAL_ESTATE_FAQ.aptSale.slice(0, 3), ...REAL_ESTATE_FAQ.aptRent.slice(0, 2), ...REAL_ESTATE_FAQ.villaSale.slice(0, 2), ...REAL_ESTATE_FAQ.offitelSale.slice(0, 2)].map(faq => ({ question: faq.q, answer: faq.a }))
    const questions = [...Object.values(CATEGORY_FAQ).flat(), ...realEstate]
    for (const faq of [...CATEGORY_GROUPS.flatMap(group => group.categories.flatMap(category => CATEGORY_FAQ[category])), ...realEstate]) { expect(wrapper.text()).toContain(faq.question); expect(wrapper.text()).toContain(faq.answer) }
    expect(schema).toHaveBeenCalledWith(questions)
  })
  it.each([['privacy', Privacy], ['terms', Terms]] as const)('links legal documents and matching clause anchors on %s', (kind, component) => {
    const wrapper = mount(component, { global: { stubs } })
    expect(wrapper.find('nav[aria-label="법적 문서"] a[href="/privacy"]').exists()).toBe(true)
    expect(wrapper.find('nav[aria-label="법적 문서"] a[href="/terms"]').exists()).toBe(true)
    expect(wrapper.find(`nav[aria-label="법적 문서"] a[href="/${kind}"]`).attributes('aria-current')).toBe('page')
    for (const link of wrapper.findAll('nav[aria-label="문서 목차"] a')) expect(wrapper.find(link.attributes('href')!).exists()).toBe(true)
  })
  it('filters FAQ visually without dropping original schema or answers', async () => {
    const wrapper = mount(Faq, { attachTo: document.body, global: { stubs } })
    const originalText = wrapper.text()
    await wrapper.findAll('button').find(button => button.text() === '생활시설')!.trigger('click')
    expect(wrapper.findAll('h2').find(heading => heading.text().includes('부동산 실거래가'))!.isVisible()).toBe(false)
    expect(wrapper.text()).toBe(originalText)
    await wrapper.findAll('button').find(button => button.text() === '전체')!.trigger('click')
    expect(wrapper.findAll('h2').every(heading => heading.isVisible())).toBe(true)
    wrapper.unmount()
  })

})
