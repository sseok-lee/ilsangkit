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
  })

  it('throws createError 404 for buy-lease (now redirected via server middleware, not handled here)', () => {
    expect(() => mountWith('buy-lease')).toThrow()
  })

  it('throws createError 404 for charter (now redirected via server middleware, not handled here)', () => {
    expect(() => mountWith('charter')).toThrow()
  })

  it('throws createError 404 for unknown slug', () => {
    expect(() => mountWith('does-not-exist')).toThrow()
  })
})
