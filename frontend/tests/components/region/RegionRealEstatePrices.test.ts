import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionRealEstatePrices from '~/components/region/RegionRealEstatePrices.vue'

const globalConfig = {
  stubs: {
    NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  },
}

const sampleCards = [
  { type: 'apt', label: '아파트', saleAvg: '5억 8,000만원', saleCount: 120, rentAvg: '3억', rentCount: 85 },
  { type: 'villa', label: '빌라', saleAvg: '2억 4,000만원', saleCount: 45, rentAvg: '1억 5,000만원', rentCount: 30 },
  { type: 'offitel', label: '오피스텔', saleAvg: '3억', saleCount: 60, rentAvg: '2억', rentCount: 50 },
]

describe('RegionRealEstatePrices', () => {
  it('3개 부동산 카드를 각각 정식 /real-estate/{type}-sale 허브로 링크(301 우회)', () => {
    const wrapper = mount(RegionRealEstatePrices, {
      props: { cards: sampleCards },
      global: globalConfig,
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
    expect(links[0].attributes('href')).toBe('/real-estate/apt-sale')
    expect(links[1].attributes('href')).toBe('/real-estate/villa-sale')
    expect(links[2].attributes('href')).toBe('/real-estate/offitel-sale')
  })

  it('각 카드에 매매 평균/거래수 + 전월세 평균/거래수 표시', () => {
    const wrapper = mount(RegionRealEstatePrices, {
      props: { cards: sampleCards },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('5억 8,000만원')
    expect(wrapper.text()).toContain('120건')
    expect(wrapper.text()).toContain('3억')
    expect(wrapper.text()).toContain('85건')
  })

  it('H2 "부동산 시세 현황" 헤딩 + section id="real-estate"', () => {
    const wrapper = mount(RegionRealEstatePrices, {
      props: { cards: sampleCards },
      global: globalConfig,
    })
    expect(wrapper.find('section#real-estate').exists()).toBe(true)
    expect(wrapper.find('h2').text()).toContain('부동산 시세 현황')
  })

  it('카드 0개면 그리드는 비어도 헤딩은 유지', () => {
    const wrapper = mount(RegionRealEstatePrices, {
      props: { cards: [] },
      global: globalConfig,
    })
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.find('h2').text()).toContain('부동산 시세 현황')
  })
})
