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

describe('subscriptionMeta — RENT_TYPES (청약 only)', () => {
  it('groups 3 청약 keys into 2 sections (apply/lh-announcement)', () => {
    const apply = rentTypesByGroup('apply').map(([slug]) => slug)
    const announcement = rentTypesByGroup('lh-announcement').map(([slug]) => slug)
    expect(apply).toEqual(['public', 'private'])
    expect(announcement).toEqual(['lh-announcement'])
  })

  it('exposes 2 group headings', () => {
    expect(RENT_GROUP_META.apply.heading).toBe('청약홈 임대 청약')
    expect(RENT_GROUP_META['lh-announcement'].heading).toBe('LH 청약공고')
  })
})

describe('subscription/rent/index.vue', () => {
  it('renders both 청약 group headings', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const text = wrapper.text()
    expect(text).toContain('청약홈 임대 청약')
    expect(text).toContain('LH 청약공고')
  })

  it('renders 3 청약 tab labels (no LH 매물)', () => {
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
    expect(text).not.toContain('LH 매입임대')
    expect(text).not.toContain('LH 전세임대')
  })

  it('separates 2 sections by data source and links out to /lh-rental', () => {
    const wrapper = mount(RentHub, {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          SubscriptionListView: true,
        },
      },
    })
    const applySection = wrapper.find('section[data-test-group="apply"]')
    const announcementSection = wrapper.find('section[data-test-group="lh-announcement"]')
    const myhomeSection = wrapper.find('section[data-test-group="lh-myhome"]')
    expect(applySection.exists()).toBe(true)
    expect(announcementSection.exists()).toBe(true)
    expect(myhomeSection.exists()).toBe(false)
    expect(applySection.text()).toContain('공공임대')
    expect(applySection.text()).toContain('민간임대')
    expect(announcementSection.text()).toContain('LH 분양/임대 공고')
    expect(wrapper.find('a[href="/lh-rental"]').exists()).toBe(true)
  })
})
