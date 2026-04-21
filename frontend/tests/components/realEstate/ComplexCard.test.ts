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

    it('거래일/건축년도가 null이면 "-"으로 표시한다', () => {
      // minTransactionCount=0 으로 thin content 필터를 우회하여 null 필드 표시 동작만 검증
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplexNoPrice, propertyType: 'apt', tab: 'sale', minTransactionCount: 0 },
      })
      const text = wrapper.text()
      expect(text).toContain('최근 거래')
      expect(text).toContain('건축년도')
      expect(text).not.toContain('2026')
      expect(text).not.toContain('2015')
    })
  })

  describe('US-004: 렌더링 필터', () => {
    it('invalid buildingName (지번)이면 렌더링을 건너뛴다', () => {
      const jibun: ComplexInfo = { ...mockComplex, buildingName: '(535-3)' }
      const wrapper = mount(ComplexCard, {
        props: { complex: jibun, propertyType: 'villa', tab: 'sale' },
      })
      // v-if 로 가드되므로 NuxtLink(a 태그) 자체가 없어야 한다
      expect(wrapper.find('a').exists()).toBe(false)
      expect(wrapper.html()).toBe('<!--v-if-->')
    })

    it('transactionCount < 10 thin content면 렌더링을 건너뛴다', () => {
      const thin: ComplexInfo = { ...mockComplex, transactionCount: 5 }
      const wrapper = mount(ComplexCard, {
        props: { complex: thin, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.find('a').exists()).toBe(false)
    })

    it('minTransactionCount 커스텀 프롭으로 필터 임계치 조정 가능', () => {
      const thin: ComplexInfo = { ...mockComplex, transactionCount: 5 }
      const wrapper = mount(ComplexCard, {
        props: { complex: thin, propertyType: 'apt', tab: 'sale', minTransactionCount: 3 },
      })
      expect(wrapper.find('a').exists()).toBe(true)
    })

    it('company-prefix (주)빌라는 정상 렌더링', () => {
      const legit: ComplexInfo = { ...mockComplex, buildingName: '(주)래미안타워' }
      const wrapper = mount(ComplexCard, {
        props: { complex: legit, propertyType: 'apt', tab: 'sale' },
      })
      expect(wrapper.find('a').exists()).toBe(true)
      expect(wrapper.text()).toContain('(주)래미안타워')
    })
  })

  describe('NuxtLink', () => {
    it('sale 탭은 canonical 정합성을 위해 tab 파라미터를 생략한다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'apt', tab: 'sale' },
      })
      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      const href = link.attributes('href')!
      expect(href).toContain('/real-estate/apt/')
      expect(href).toContain(encodeURIComponent('대치아이파크'))
      expect(href).toContain('bjdCode=1168010100')
      // tab=sale은 페이지 기본값이므로 제거 (canonical URL과 일치 → 크롤 예산 절감)
      expect(href).not.toContain('tab=sale')
      expect(href).not.toContain('tab=')
    })

    it('rent 탭은 기본값이 아니므로 tab=rent를 유지한다', () => {
      const wrapper = mount(ComplexCard, {
        props: { complex: mockComplex, propertyType: 'villa', tab: 'rent' },
      })
      const link = wrapper.find('a')
      const href = link.attributes('href')!
      expect(href).toContain('/real-estate/villa/')
      expect(href).toContain('tab=rent')
      expect(href).toContain('bjdCode=1168010100')
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
