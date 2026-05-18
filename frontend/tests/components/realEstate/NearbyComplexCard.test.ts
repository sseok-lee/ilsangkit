import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
import type { NearbyComplexItem } from '~/types/realEstate'

// latestPrice는 만원 단위 (예: 150_000 = 15억)
const baseItem: NearbyComplexItem = {
  buildingName: '래미안', bjdCode: '1144012700',
  city: '서울특별시', district: '마포구', dongName: '한강로동',
  buildYear: 2018, transactionCount: 3,
  latestPrice: 150_000, monthlyRent: null, latestDealYear: 2026, latestDealMonth: 4,
  lat: 37.55, lng: 126.96,
}

describe('NearbyComplexCard', () => {
  it('단지명과 주소를 표시한다', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('래미안')
    expect(wrapper.text()).toContain('한강로동')
  })

  it('라벨은 항상 "최근 거래가"', () => {
    const modes: Array<{ mode: 'sale' | 'rent'; rentType: 'all' | 'jeonse' | 'wolse' }> = [
      { mode: 'sale', rentType: 'all' },
      { mode: 'rent', rentType: 'all' },
      { mode: 'rent', rentType: 'jeonse' },
      { mode: 'rent', rentType: 'wolse' },
    ]
    for (const { mode, rentType } of modes) {
      const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode, rentType } })
      expect(wrapper.text()).toContain('최근 거래가')
    }
  })

  it('링크 URL이 propertyType+mode 조합', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'villa', mode: 'sale', rentType: 'all' } })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toContain('/real-estate/villa-sale/')
  })

  it('가격 포맷팅 — 150000만원 → "15억"', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('15억')
  })

  it('가격 포맷팅 — 70000만원 → "7억"', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: { item: { ...baseItem, latestPrice: 70_000 }, propertyType: 'apt', mode: 'sale', rentType: 'all' },
    })
    expect(wrapper.text()).toContain('7억')
  })

  it('가격 포맷팅 — 5500만원 → "5,500만"', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: { item: { ...baseItem, latestPrice: 5_500 }, propertyType: 'villa', mode: 'sale', rentType: 'all' },
    })
    expect(wrapper.text()).toContain('5,500만')
  })

  it('가격 포맷팅 — 12500만원 → "1억 2,500만"', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: { item: { ...baseItem, latestPrice: 12_500 }, propertyType: 'apt', mode: 'sale', rentType: 'all' },
    })
    expect(wrapper.text()).toContain('1억 2,500만')
  })

  it('가격이 null이면 "-" 표시', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: { ...baseItem, latestPrice: null }, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('-')
  })

  it('월세 거래 — 보증금/월세 형식 (예: 1000만/54만)', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: {
        item: { ...baseItem, latestPrice: 1_000, monthlyRent: 54 },
        propertyType: 'apt', mode: 'rent', rentType: 'wolse',
      },
    })
    expect(wrapper.text()).toContain('1,000만/54만')
  })

  it('전세 거래 (monthlyRent=0) — 보증금만 표시', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: {
        item: { ...baseItem, latestPrice: 50_000, monthlyRent: 0 },
        propertyType: 'apt', mode: 'rent', rentType: 'jeonse',
      },
    })
    expect(wrapper.text()).toContain('5억')
    expect(wrapper.text()).not.toContain('/')
  })

  it('메타 행에 건축년도/최근 거래일/거래 건수 표시', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: {
        item: { ...baseItem, buildYear: 2018, latestDealYear: 2026, latestDealMonth: 4, transactionCount: 12 },
        propertyType: 'apt', mode: 'sale', rentType: 'all',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('2018년')
    expect(text).toContain('2026.04')
    expect(text).toContain('12건')
  })

  it('메타 정보가 모두 null/0이면 메타 행 자체가 안 그려짐', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: {
        item: { ...baseItem, buildYear: null, latestDealYear: null, latestDealMonth: null, transactionCount: 0 },
        propertyType: 'apt', mode: 'sale', rentType: 'all',
      },
    })
    expect(wrapper.find('dl').exists()).toBe(false)
  })

  it('rent + monthlyRent null — 보증금만 표시', () => {
    const wrapper = mount(NearbyComplexCard, {
      props: {
        item: { ...baseItem, latestPrice: 30_000, monthlyRent: null },
        propertyType: 'apt', mode: 'rent', rentType: 'all',
      },
    })
    expect(wrapper.text()).toContain('3억')
    expect(wrapper.text()).not.toContain('/')
  })
})
