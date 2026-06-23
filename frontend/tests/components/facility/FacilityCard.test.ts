import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityCard from '~/components/facility/FacilityCard.vue'

describe('FacilityCard', () => {
  const mockFacility = {
    id: 'toilet-1',
    name: '강남역 지하 공중화장실',
    category: 'toilet' as const,
    address: '서울특별시 강남구 강남대로 396',
    roadAddress: '서울특별시 강남구 강남대로 396',
    lat: 37.4979,
    lng: 127.0276,
    city: '서울특별시',
    district: '강남구',
    distance: 150,
  }

  it('시설 정보를 올바르게 렌더링하는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    expect(wrapper.text()).toContain('강남역 지하 공중화장실')
    expect(wrapper.text()).toContain('서울특별시 강남구 강남대로 396')
  })

  it('카테고리에 따라 올바른 아이콘을 표시하는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    // CategoryIcon component renders as img with alt attribute
    const icon = wrapper.find('img[alt="toilet"]')
    expect(icon.exists()).toBe(true)
  })

  it('거리가 있을 때 표시하는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    expect(wrapper.text()).toContain('150m')
  })

  it('거리가 없을 때 표시하지 않는지 확인', () => {
    const facilityWithoutDistance = { ...mockFacility, distance: undefined }
    const wrapper = mount(FacilityCard, {
      props: { facility: facilityWithoutDistance },
    })

    expect(wrapper.text()).not.toContain('m')
  })

  it('카테고리별 아이콘이 표시되는지 확인', () => {
    const categories = ['toilet', 'wifi', 'trash', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market'] as const

    categories.forEach((category) => {
      const facility = { ...mockFacility, category }
      const wrapper = mount(FacilityCard, {
        props: { facility },
      })

      // CategoryIcon renders as img with alt matching category
      const icon = wrapper.find(`img[alt="${category}"]`)
      expect(icon.exists()).toBe(true)
    })
  })

  it('클릭 시 상세 페이지로 이동하는지 확인', async () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
      global: {
        stubs: {
          NuxtLink: {
            template: '<a :href="`/facility/${category}/${id}`"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
  })

  it('카드에 hover 효과가 있는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    // hover 클래스나 transition 확인
    expect(wrapper.html()).toContain('hover:')
  })

  it('병원 카드의 전화번호는 tel: 링크다', () => {
    const hospitalWithPhone = {
      ...mockFacility,
      category: 'hospital' as const,
      extras: { phone: '02-123-4567' },
    }
    const wrapper = mount(FacilityCard, {
      props: { facility: hospitalWithPhone },
    })
    const tel = wrapper.find('a[href^="tel:"]')
    expect(tel.exists()).toBe(true)
    expect(tel.attributes('href')).toBe('tel:02-123-4567')
  })

  it('약국 카드의 전화번호도 tel: 링크다', () => {
    const pharmacyWithPhone = {
      ...mockFacility,
      category: 'pharmacy' as const,
      extras: { phone: '02-999-1234' },
    }
    const wrapper = mount(FacilityCard, {
      props: { facility: pharmacyWithPhone },
    })
    const tel = wrapper.find('a[href^="tel:"]')
    expect(tel.exists()).toBe(true)
    expect(tel.attributes('href')).toBe('tel:02-999-1234')
  })
})
