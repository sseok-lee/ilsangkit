import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailContextLinks from '~/components/facility/detail/DetailContextLinks.vue'

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackPhoneClick: vi.fn() }),
}))

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  RelatedGuides: { template: '<div />' },
  SectionBlock: {
    template: '<div><slot /><slot name="right" /></div>',
    props: ['heading', 'subtext', 'size'],
  },
  DataSourceSection: { template: '<div />' },
}

const regionLink = {
  href: '/seoul/gangnam-gu/hospital',
  label: '강남구 병원 목록',
  cityHref: '/seoul',
  cityLabel: '서울 전체 병원',
}

const baseProps = {
  category: 'hospital' as const,
  regionLink,
  relatedCategories: [] as any[],
  categoryMeta: { label: '병원' },
  categoryTips: [] as string[],
  categoryFaqItems: [] as any[],
  lastSyncDate: null,
}

describe('DetailContextLinks — 부동산 교차 링크', () => {
  it('regionLink 가 있을 때 /real-estate/apt-sale/{city}/{district} 링크가 렌더된다', () => {
    const wrapper = mount(DetailContextLinks, {
      props: baseProps,
      global: { stubs },
    })
    const realEstateLink = wrapper.find('a[href="/real-estate/apt-sale/seoul/gangnam-gu"]')
    expect(realEstateLink.exists()).toBe(true)
  })

  it('부동산 교차 링크에 "이 지역 부동산 시세" 텍스트가 있다', () => {
    const wrapper = mount(DetailContextLinks, {
      props: baseProps,
      global: { stubs },
    })
    expect(wrapper.text()).toContain('이 지역 부동산 시세')
  })

  it('regionLink 가 null 이면 부동산 링크가 없다', () => {
    const wrapper = mount(DetailContextLinks, {
      props: { ...baseProps, regionLink: null },
      global: { stubs },
    })
    const realEstateLink = wrapper.find('a[href*="real-estate"]')
    expect(realEstateLink.exists()).toBe(false)
  })
})
