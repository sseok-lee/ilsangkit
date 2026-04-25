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
  it('apply group 청약 keys 는 public, private 이다', () => {
    const apply = rentTypesByGroup('apply').map(([slug]) => slug)
    expect(apply).toEqual(['public', 'private'])
  })

  it('apply group heading 이 노출된다', () => {
    expect(RENT_GROUP_META.apply.heading).toBe('청약홈 임대 청약')
  })
})

describe('subscription/rent/index.vue', () => {
  it('renders 청약홈 임대 청약 group heading', () => {
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
  })

  it('renders 2 청약 tab labels (공공임대, 민간임대)', () => {
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
    expect(text).not.toContain('LH 매입임대')
    expect(text).not.toContain('LH 전세임대')
  })

  it('shows only apply section and links out to /lh-rental', () => {
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
    expect(applySection.exists()).toBe(true)
    expect(announcementSection.exists()).toBe(false)
    expect(applySection.text()).toContain('공공임대')
    expect(applySection.text()).toContain('민간임대')
    expect(wrapper.find('a[href="/lh-rental"]').exists()).toBe(true)
  })
})
