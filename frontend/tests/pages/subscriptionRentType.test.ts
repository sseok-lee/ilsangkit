import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RentType from '~/pages/subscription/rent/[type].vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

const mockSetMeta = vi.fn()
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: mockSetMeta }),
}))

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  SubscriptionListView: { template: '<div data-test-pane="applyhome">applyhome pane</div>', props: ['sourceType', 'rentType'] },
  PublicRentalListView: { template: '<div data-test-pane="lh-myhome">{{ rentalTypeCode }}</div>', props: ['rentalTypeCode'] },
  DataSourceSection: { template: '<div />' },
}

function mountWith(typeSlug: string) {
  vi.stubGlobal('useRoute', () => ({ params: { type: typeSlug } }))
  vi.stubGlobal('createError', (e: unknown) => {
    throw e
  })
  return mount(RentType, { global: { stubs } })
}

describe('subscription/rent/[type].vue dataSource branching', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
  })

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

describe('subscription/rent/[type].vue — title no duplicate 청약/임대', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
  })

  it('public: title is just the label (공공임대 청약), no trailing 임대 청약', () => {
    mountWith('public')
    const call = mockSetMeta.mock.calls[0][0]
    expect(call.title).toBe('공공임대 청약')
    expect(call.title).not.toMatch(/임대 청약 임대 청약/)
    expect(call.title).not.toMatch(/청약 임대 청약/)
  })

  it('private: title is just the label (공공지원 민간임대), no trailing 임대 청약', () => {
    mountWith('private')
    const call = mockSetMeta.mock.calls[0][0]
    expect(call.title).toBe('공공지원 민간임대')
    expect(call.title).not.toMatch(/임대 임대 청약/)
    expect(call.title).not.toMatch(/임대 청약/)
  })
})
