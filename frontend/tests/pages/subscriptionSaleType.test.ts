import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleIndex from '~/pages/subscription/sale/index.vue'
import SaleType from '~/pages/subscription/sale/[type].vue'

const mockSetMeta = vi.fn()
const mockUseHead = vi.fn()

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: mockSetMeta }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setItemListSchema: vi.fn() }),
}))

vi.stubGlobal('useHead', mockUseHead)

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  SubscriptionListView: { name: 'SubscriptionListView', template: '<div data-testid="sale-list" />', props: ['scope'] },
  DataSourceSection: { template: '<div />' },
}

function mountWith(typeSlug: string, query: Record<string, string> = {}) {
  vi.stubGlobal('useRoute', () => ({ path: `/subscription/sale/${typeSlug}`, params: { type: typeSlug }, query }))
  vi.stubGlobal('createError', (e: unknown) => {
    throw e
  })
  return mount(SaleType, { global: { stubs } })
}

describe('subscription/sale/[type].vue', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
    mockUseHead.mockClear()
  })

  it('passes sale and APT scope together for apt subtype', () => {
    const wrapper = mountWith('apt')
    const list = wrapper.findComponent({ name: 'SubscriptionListView' })
    expect(list.props('scope')).toEqual({ category: 'sale', type: 'apt', sourceType: 'APT' })
  })



  it('uses normalized filter state for sale type SEO head', () => {
    mountWith('apt', { status: 'unknown', sort: 'priority' })
    const defaultHead = mockUseHead.mock.calls.at(-1)?.[0]()
    expect(defaultHead.meta).toContainEqual({ name: 'robots', content: 'index, follow' })
    expect(defaultHead.link).not.toEqual([])

    mockUseHead.mockClear()
    mountWith('apt', { status: 'ongoing' })
    const filteredHead = mockUseHead.mock.calls.at(-1)?.[0]()
    expect(filteredHead.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(filteredHead.link).toEqual([])
  })

  it('uses remaining for the 무순위 path and throws 404 for unrestricted', () => {
    const wrapper = mountWith('remaining')
    expect(wrapper.findComponent({ name: 'SubscriptionListView' }).props('scope')).toEqual({
      category: 'sale',
      type: 'remaining',
      sourceType: 'REMAINING',
    })
    expect(() => mountWith('unrestricted')).toThrow()
  })
})


describe('subscription/sale/index.vue — normalized SEO head', () => {
  beforeEach(() => {
    mockSetMeta.mockClear()
    mockUseHead.mockClear()
  })

  it('does not noindex default-only query but noindexes real and protected filters', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/subscription/sale', params: {}, query: { status: 'all', sort: 'priority' } }))
    mount(SaleIndex, { global: { stubs } })
    expect(mockUseHead.mock.calls.at(-1)?.[0]().meta).toContainEqual({ name: 'robots', content: 'index, follow' })

    mockUseHead.mockClear()
    vi.stubGlobal('useRoute', () => ({ path: '/subscription/sale', params: {}, query: { q: '가'.repeat(101) } }))
    mount(SaleIndex, { global: { stubs } })
    expect(mockUseHead.mock.calls.at(-1)?.[0]().meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
  })
})
