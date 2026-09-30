import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RentHub from '~/pages/subscription/rent/index.vue'
import { rentTypesByGroup, RENT_GROUP_META } from '~/utils/subscriptionMeta'

const mockUseHead = vi.fn()
vi.stubGlobal('useHead', mockUseHead)

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
  }),
}))

describe('subscriptionMeta — RENT_TYPES (integrated rent)', () => {
  it('apply group 청약 keys 는 public, private 이다', () => {
    const apply = rentTypesByGroup('apply').map(([slug]) => slug)
    expect(apply).toEqual(['public', 'private'])
  })

  it('apply group heading 이 노출된다', () => {
    expect(RENT_GROUP_META.apply.heading).toBe('임대주택 모집공고')
  })
})

describe('subscription/rent/index.vue', () => {
  beforeEach(() => {
    mockUseHead.mockClear()
    vi.stubGlobal('useRoute', () => ({ path: '/subscription/rent', params: {}, query: {} }))
  })
  it('renders integrated rent group heading', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const text = wrapper.text()
    expect(text).toContain('임대주택 모집공고')
    expect(text).toContain('청약홈 · 마이홈 · LH')
  })

  it('통합 임대 안내는 청약홈 단독/청약통장 필수로 오해시키지 않는다', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const text = wrapper.text()
    expect(text).toContain('청약홈 · 마이홈 · LH')
    expect(text).not.toContain('청약통장으로 접수')
    expect(text).not.toContain('LH 분양·임대')
  })

  it('does not render the obsolete rent group intro before the shared list', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    expect(wrapper.find('section[data-test-group="apply"]').exists()).toBe(false)
    expect(wrapper.find('section[data-test-group="lh-announcement"]').exists()).toBe(false)
  })



  it('uses normalized filter state for rent index SEO head', () => {
    vi.stubGlobal('useRoute', () => ({ path: '/subscription/rent', params: {}, query: { sort: 'priority' } }))
    mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    expect(mockUseHead.mock.calls.at(-1)?.[0]().meta).toContainEqual({ name: 'robots', content: 'index, follow' })

    mockUseHead.mockClear()
    vi.stubGlobal('useRoute', () => ({ path: '/subscription/rent', params: {}, query: { city: '서울특별시' } }))
    mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    expect(mockUseHead.mock.calls.at(-1)?.[0]().meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
  })

  it('passes a rent scope to the shared list view', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          SubscriptionListView: { name: 'SubscriptionListView', template: '<div />', props: ['scope'] },
        },
      },
    })
    expect(wrapper.findComponent({ name: 'SubscriptionListView' }).props('scope')).toEqual({ category: 'rent' })
  })
})
