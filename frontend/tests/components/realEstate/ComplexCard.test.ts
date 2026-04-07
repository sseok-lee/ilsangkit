import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComplexCard from '~/components/realEstate/ComplexCard.vue'
import type { ComplexInfo } from '~/types/realEstate'

const mockComplex: ComplexInfo = {
  buildingName: '대치아이파크',
  bjdCode: '1168010100',
  dongName: '대치동',
  city: '서울특별시',
  district: '강남구',
  latestPrice: 150000,
  transactionCount: 25,
  lat: 37.5,
  lng: 127.0,
  lastDealYear: 2026,
  lastDealMonth: 3,
  buildYear: 2015,
}

const mockComplexNoPrice: ComplexInfo = {
  buildingName: '테스트빌라',
  bjdCode: '1168010200',
  dongName: '역삼동',
  city: '서울특별시',
  district: '강남구',
  latestPrice: null,
  transactionCount: 0,
  lat: null,
  lng: null,
  lastDealYear: null,
  lastDealMonth: null,
  buildYear: null,
}

describe('ComplexCard', () => {
  it('건물명을 표시한다', () => {
    const wrapper = mount(ComplexCard, {
      props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
    })
    expect(wrapper.text()).toContain('대치아이파크')
  })

  it('거래 건수를 표시한다', () => {
    const wrapper = mount(ComplexCard, {
      props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
    })
    expect(wrapper.text()).toContain('25')
  })

  describe('거래일/건축년도 표시', () => {
    it('최근 거래일과 건축년도를 표시한다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.text()).toContain('2026.03')
      expect(wrapper.text()).toContain('2015년')
    })

    it('거래일/건축년도가 null이면 표시하지 않는다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplexNoPrice, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.text()).not.toContain('년')
    })
  })

  describe('NuxtLink', () => {
    it('올바른 경로로 링크를 생성한다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
      })
      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      const href = link.attributes('href')!
      expect(href).toContain('/real-estate/apt/')
      expect(href).toContain(encodeURIComponent('대치아이파크'))
      expect(href).toContain('tab=sale')
      expect(href).toContain('bjdCode=1168010100')
    })

    it('다른 propertyType과 tab에 따라 링크 경로가 달라진다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'villa', tab: 'rent' },
      })
      const link = wrapper.find('a')
      const href = link.attributes('href')!
      expect(href).toContain('/real-estate/villa/')
      expect(href).toContain('tab=rent')
    })
  })

  describe('스타일', () => {
    it('호버 효과 클래스가 있다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.html()).toContain('hover:')
    })

    it('카드 UI 스타일 클래스가 있다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.html()).toContain('rounded')
    })
  })
})
