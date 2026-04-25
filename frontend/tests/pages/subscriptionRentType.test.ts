import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RentType from '~/pages/subscription/rent/[type].vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  SubscriptionListView: { template: '<div data-test-pane="applyhome">applyhome pane</div>', props: ['sourceType', 'rentType'] },
  PublicRentalListView: { template: '<div data-test-pane="lh-myhome">{{ rentalTypeCode }}</div>', props: ['rentalTypeCode'] },
  LhAnnouncementListView: { template: '<div data-test-pane="lh-announcement">lh-announcement pane</div>' },
}

function mountWith(typeSlug: string) {
  vi.stubGlobal('useRoute', () => ({ params: { type: typeSlug } }))
  vi.stubGlobal('createError', (e: unknown) => {
    throw e
  })
  return mount(RentType, { global: { stubs } })
}

describe('subscription/rent/[type].vue dataSource branching', () => {
  it('renders SubscriptionListView for applyhome (public)', () => {
    const wrapper = mountWith('public')
    expect(wrapper.find('[data-test-pane="applyhome"]').exists()).toBe(true)
    expect(wrapper.find('[data-test-pane="lh-myhome"]').exists()).toBe(false)
    expect(wrapper.find('[data-test-pane="lh-announcement"]').exists()).toBe(false)
  })

  it('renders PublicRentalListView for lh-myhome (buy-lease) with rentalTypeCode prop', () => {
    const wrapper = mountWith('buy-lease')
    const pane = wrapper.find('[data-test-pane="lh-myhome"]')
    expect(pane.exists()).toBe(true)
    expect(pane.text()).toContain('매입임대')
  })

  it('renders PublicRentalListView for charter slug with 전세임대 code', () => {
    const wrapper = mountWith('charter')
    const pane = wrapper.find('[data-test-pane="lh-myhome"]')
    expect(pane.exists()).toBe(true)
    expect(pane.text()).toContain('전세임대')
  })

  it('renders LhAnnouncementListView for lh-announcement slug', () => {
    const wrapper = mountWith('lh-announcement')
    expect(wrapper.find('[data-test-pane="lh-announcement"]').exists()).toBe(true)
  })

  it('throws createError 404 for unknown slug', () => {
    expect(() => mountWith('does-not-exist')).toThrow()
  })
})
