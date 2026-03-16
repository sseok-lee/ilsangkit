import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarketDetail from '~/components/facility/details/MarketDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { MarketDetails } from '~/types/facility'

describe('MarketDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: MarketDetails = {
      marketType: '상설시장',
      openingCycle: '매일',
      storeCount: 250,
      foundedYear: 1985,
      phoneNumber: '02-1234-5678',
      products: '농산물+수산물+육류',
      homepageUrl: 'https://market.example.com',
      hasPublicToilet: true,
      hasParking: false,
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('상설시장')
    expect(wrapper.text()).toContain('매일')
    expect(wrapper.text()).toContain('250')
    expect(wrapper.text()).toContain('1985')
    expect(wrapper.text()).toContain('02-1234-5678')
    expect(wrapper.text()).toContain('농산물')
    expect(wrapper.text()).toContain('수산물')
    expect(wrapper.text()).toContain('육류')
  })

  it('marketType 뱃지: 상설장=blue', () => {
    const details: MarketDetails = {
      marketType: '상설장',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('상설장')
  })

  it('marketType 뱃지: 일장=orange', () => {
    const details: MarketDetails = {
      marketType: '5일장',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-orange-100')
    expect(badge.exists()).toBe(true)
  })

  it('openingCycle 날짜 기반 포맷 변환', () => {
    const details: MarketDetails = {
      openingCycle: '1일+6일',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('매월 1일, 6일')
  })

  it('products "+" 구분 텍스트를 태그 칩으로 렌더링', () => {
    const details: MarketDetails = {
      products: '농산물+축산물+가공식품+의류',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    const chips = wrapper.findAll('.rounded-full')
    expect(chips.length).toBeGreaterThanOrEqual(4)
    expect(wrapper.text()).toContain('농산물')
    expect(wrapper.text()).toContain('축산물')
    expect(wrapper.text()).toContain('가공식품')
    expect(wrapper.text()).toContain('의류')
  })

  it('giftCertificates 필드 미노출', () => {
    const details: MarketDetails = {
      marketType: '상설시장',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.html()).not.toContain('상품권')
  })

  it('storeCount 숫자 포맷 렌더링', () => {
    const details: MarketDetails = {
      storeCount: 1500,
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('1,500')
  })

  it('hasPublicToilet ✓ 표시', () => {
    const details: MarketDetails = {
      hasPublicToilet: true,
      hasParking: false,
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('✓')
    expect(wrapper.text()).toContain('✗')
  })

  it('homepageUrl 외부 링크 렌더링', () => {
    const details: MarketDetails = {
      homepageUrl: 'https://market.example.com',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('phoneNumber type="phone" 링크 렌더링', () => {
    const details: MarketDetails = {
      phoneNumber: '02-1234-5678',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[href^="tel:"]')
    expect(link.exists()).toBe(true)
  })

  it('null/undefined 필드 숨김 처리', () => {
    const details: MarketDetails = {
      marketType: '5일장',
    }

    const wrapper = mount(MarketDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('5일장')
    expect(wrapper.html()).not.toContain('연락처')
  })
})
