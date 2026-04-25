import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LhRentalType from '~/pages/lh-rental/[type].vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  PublicRentalListView: { template: '<div data-test-pane="lh-myhome">{{ rentalTypeCode }}</div>', props: ['rentalTypeCode'] },
}

function mountWith(typeSlug: string) {
  vi.stubGlobal('useRoute', () => ({ params: { type: typeSlug } }))
  vi.stubGlobal('createError', (e: unknown) => {
    throw e
  })
  return mount(LhRentalType, { global: { stubs } })
}

describe('lh-rental/[type].vue', () => {
  it('passes 매입임대 rentalTypeCode for buy-lease slug', () => {
    const wrapper = mountWith('buy-lease')
    const pane = wrapper.find('[data-test-pane="lh-myhome"]')
    expect(pane.exists()).toBe(true)
    expect(pane.text()).toContain('매입임대')
  })

  it('passes 전세임대 rentalTypeCode for charter slug', () => {
    const wrapper = mountWith('charter')
    const pane = wrapper.find('[data-test-pane="lh-myhome"]')
    expect(pane.exists()).toBe(true)
    expect(pane.text()).toContain('전세임대')
  })

  it('throws createError 404 for unknown slug', () => {
    expect(() => mountWith('does-not-exist')).toThrow()
  })
})
