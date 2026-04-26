import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LhRentalHub from '~/pages/lh-rental/index.vue'
import { LH_RENTAL_TYPES } from '~/utils/subscriptionMeta'

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
})

describe('subscriptionMeta — LH_RENTAL_TYPES', () => {
  it('contains buy-lease and charter with rentalTypeCode', () => {
    expect(Object.keys(LH_RENTAL_TYPES)).toEqual(['buy-lease', 'charter'])
    expect(LH_RENTAL_TYPES['buy-lease'].rentalTypeCode).toBe('매입임대')
    expect(LH_RENTAL_TYPES.charter.rentalTypeCode).toBe('전세임대')
  })
})

describe('lh-rental/index.vue (LH 임대 hub)', () => {
  function mountHub() {
    return mount(LhRentalHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          PublicRentalListView: { template: '<div data-test-pane="lh-myhome-all" />' },
        },
      },
    })
  }

  it('renders heading and 2 type chips', () => {
    const wrapper = mountHub()
    expect(wrapper.text()).toContain('LH 매입·전세임대')
    expect(wrapper.text()).toContain('LH 매입임대')
    expect(wrapper.text()).toContain('LH 전세임대')
  })

  it('renders chip links to /lh-rental/buy-lease and /lh-rental/charter', () => {
    const wrapper = mountHub()
    expect(wrapper.find('a[href="/lh-rental/buy-lease"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/lh-rental/charter"]').exists()).toBe(true)
  })

  it('renders combined PublicRentalListView (no rentalTypeCode prop)', () => {
    const wrapper = mountHub()
    expect(wrapper.find('[data-test-pane="lh-myhome-all"]').exists()).toBe(true)
  })
})

describe('lh-rental/index.vue — breadcrumb schema', () => {
  function mountHub() {
    return mount(LhRentalHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          PublicRentalListView: { template: '<div />' },
        },
      },
    })
  }

  it('breadcrumb에 청약·임대 중간 단계가 포함되어야 한다', () => {
    mountHub()
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const breadcrumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(breadcrumbs).toHaveLength(3)
    expect(breadcrumbs[1].name).toBe('청약·임대')
    expect(breadcrumbs[1].url).toContain('/subscription')
  })
})
