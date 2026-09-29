import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RentType from '~/pages/subscription/rent/[type].vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

const mockSetMeta = vi.fn()
const mockUseHead = vi.fn()
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: mockSetMeta }),
}))

vi.stubGlobal('useHead', mockUseHead)

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  SubscriptionListView: { name: 'SubscriptionListView', template: '<div data-test-pane="applyhome">applyhome pane</div>', props: ['scope'] },
  DataSourceSection: { template: '<div />' },
}

function mountWith(typeSlug: string, query: Record<string, string> = {}) {
  vi.stubGlobal('useRoute', () => ({ path: `/subscription/rent/${typeSlug}`, params: { type: typeSlug }, query }))
  vi.stubGlobal('createError', (e: unknown) => {
    throw e
  })
  return mount(RentType, { global: { stubs } })
}

describe('subscription/rent/[type].vue dataSource branching', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
    mockUseHead.mockClear()
  })

  it('renders SubscriptionListView for applyhome (public)', () => {
    const wrapper = mountWith('public')
    expect(wrapper.find('[data-test-pane="applyhome"]').exists()).toBe(true)
  })

  it('public passes rent category without sourceType so APT and PUBLIC_RENT are queried together', () => {
    const wrapper = mountWith('public')
    const list = wrapper.findComponent({ name: 'SubscriptionListView' })
    expect(list.props('scope')).toEqual({
      category: 'rent',
      type: 'public',
      rentType: '임대주택',
    })
  })

  it('private still restricts to PRIVATE_RENT sourceType', () => {
    const wrapper = mountWith('private')
    const list = wrapper.findComponent({ name: 'SubscriptionListView' })
    expect(list.props('scope')).toEqual({
      category: 'rent',
      type: 'private',
      sourceType: 'PRIVATE_RENT',
    })
  })



  it('uses normalized filter state for rent type SEO head', () => {
    mountWith('private', { status: 'unknown', sort: 'priority' })
    const privateDefaultHead = mockUseHead.mock.calls.at(-1)?.[0]()
    expect(privateDefaultHead.meta).toContainEqual({ name: 'robots', content: 'index, follow' })
    expect(privateDefaultHead.link).not.toEqual([])

    mockUseHead.mockClear()
    mountWith('public', { status: 'unknown' })
    const publicUnknownHead = mockUseHead.mock.calls.at(-1)?.[0]()
    expect(publicUnknownHead.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(publicUnknownHead.link).toEqual([])
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
