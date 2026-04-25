import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RentHub from '~/pages/subscription/rent/index.vue'
import { rentTypesByGroup, RENT_GROUP_META } from '~/utils/subscriptionMeta'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
  }),
}))

describe('subscriptionMeta — extended RENT_TYPES', () => {
  it('contains all 5 keys (public, private, lh-announcement, buy-lease, charter)', () => {
    const cheongyak = rentTypesByGroup('cheongyak').map(([slug]) => slug)
    const relief = rentTypesByGroup('relief').map(([slug]) => slug)
    expect(cheongyak).toEqual(expect.arrayContaining(['public', 'private', 'lh-announcement']))
    expect(relief).toEqual(expect.arrayContaining(['buy-lease', 'charter']))
    expect(cheongyak).toHaveLength(3)
    expect(relief).toHaveLength(2)
  })

  it('cheongyak group meta has correct heading', () => {
    expect(RENT_GROUP_META.cheongyak.heading).toBe('청약으로 신청')
    expect(RENT_GROUP_META.relief.heading).toBe('수시 모집')
  })
})

describe('subscription/rent/index.vue', () => {
  it('renders both group headings', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    expect(wrapper.text()).toContain('청약으로 신청')
    expect(wrapper.text()).toContain('수시 모집')
  })

  it('renders all 5 tab labels', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const text = wrapper.text()
    expect(text).toContain('공공임대')
    expect(text).toContain('민간임대')
    expect(text).toContain('LH 분양/임대 공고')
    expect(text).toContain('LH 매입임대')
    expect(text).toContain('LH 전세임대')
  })

  it('separates groups into distinct sections', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const cheongyakSection = wrapper.find('section[data-test-group="cheongyak"]')
    const reliefSection = wrapper.find('section[data-test-group="relief"]')
    expect(cheongyakSection.exists()).toBe(true)
    expect(reliefSection.exists()).toBe(true)
    expect(cheongyakSection.text()).toContain('LH 분양/임대 공고')
    expect(reliefSection.text()).toContain('LH 매입임대')
    expect(reliefSection.text()).toContain('LH 전세임대')
  })
})
