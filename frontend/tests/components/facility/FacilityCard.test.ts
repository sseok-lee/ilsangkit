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

  it('병원 카드의 전화번호는 텍스트로 표시하고 tel: 링크를 중첩하지 않는다', () => {
    const hospitalWithPhone = {
      ...mockFacility,
      category: 'hospital' as const,
      extras: { phone: '02-123-4567' },
    }
    const wrapper = mount(FacilityCard, {
      props: { facility: hospitalWithPhone },
    })
    // 번호는 노출되지만 카드 링크(<a>) 안에 tel: <a>를 중첩하지 않는다.
    expect(wrapper.text()).toContain('02-123-4567')
    expect(wrapper.find('a[href^="tel:"]').exists()).toBe(false)
  })

  it('약국 카드의 전화번호도 텍스트로 표시하고 tel: 링크를 중첩하지 않는다', () => {
    const pharmacyWithPhone = {
      ...mockFacility,
      category: 'pharmacy' as const,
      extras: { phone: '02-999-1234' },
    }
    const wrapper = mount(FacilityCard, {
      props: { facility: pharmacyWithPhone },
    })
    expect(wrapper.text()).toContain('02-999-1234')
    expect(wrapper.find('a[href^="tel:"]').exists()).toBe(false)
  })

  // 회귀 방지: 카드 전체가 상세로 가는 <a>(HardLink)이므로, 그 안에 또 다른 <a>를
  // 중첩하면 브라우저가 SSR HTML을 재구성해 하이드레이션 불일치가 발생하고
  // 카드 href가 다른 시설로 어긋난다(P0). 카드에는 링크가 정확히 1개여야 한다.
  it('전화가 있는 병원/약국/학교 카드도 <a>를 중첩하지 않는다 (SSR 하이드레이션 안정성)', () => {
    const cases = [
      { category: 'hospital' as const, extras: { phone: '02-123-4567' }, phone: '02-123-4567' },
      { category: 'pharmacy' as const, extras: { phone: '02-999-1234' }, phone: '02-999-1234' },
      { category: 'school' as const, extras: { phoneNumber: '02-777-8888' }, phone: '02-777-8888' },
    ]
    for (const c of cases) {
      const wrapper = mount(FacilityCard, {
        props: { facility: { ...mockFacility, category: c.category, extras: c.extras } },
      })
      expect(wrapper.findAll('a')).toHaveLength(1)
      expect(wrapper.find('a[href^="tel:"]').exists()).toBe(false)
      expect(wrapper.text()).toContain(c.phone)
    }
  })
})
