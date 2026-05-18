import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
import type { NearbyComplexItem } from '~/types/realEstate'

const baseItem: NearbyComplexItem = {
  buildingName: '래미안', bjdCode: '1144012700',
  city: '서울특별시', district: '마포구', dongName: '한강로동',
  buildYear: 2018, transactionCount: 3,
  latestPrice: 1_500_000_000, latestDealYear: 2026, latestDealMonth: 4,
  lat: 37.55, lng: 126.96,
}

describe('NearbyComplexCard', () => {
  it('단지명과 주소를 표시한다', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('래미안')
    expect(wrapper.text()).toContain('한강로동')
  })

  it('mode=sale → "매매" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toMatch(/매매/)
  })

  it('mode=rent + rentType=jeonse → "전세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'jeonse' } })
    expect(wrapper.text()).toMatch(/전세/)
  })

  it('mode=rent + rentType=wolse → "월세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'wolse' } })
    expect(wrapper.text()).toMatch(/월세/)
  })

  it('mode=rent + rentType=all → "전월세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'all' } })
    expect(wrapper.text()).toMatch(/전월세/)
  })

  it('링크 URL이 propertyType+mode 조합', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'villa', mode: 'sale', rentType: 'all' } })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toContain('/real-estate/villa-sale/')
  })

  it('가격 포맷팅 — 15억', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('15억')
  })

  it('가격이 null이면 "-" 표시', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: { ...baseItem, latestPrice: null }, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('-')
  })
})
