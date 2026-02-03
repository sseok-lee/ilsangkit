import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityCard from '~/components/facility/FacilityCard.vue'

describe('FacilityCard', () => {
  const mockFacility = {
    id: 'toilet-1',
    name: '강남역 지하 공중화장실',
    category: 'toilet' as const,
    address: '서울특별시 강남구 강남대로 396',
    lat: 37.4979,
    lng: 127.0276,
    distance: 150,
  }

  it('시설 정보를 올바르게 렌더링하는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    expect(wrapper.text()).toContain('강남역 지하 공중화장실')
    expect(wrapper.text()).toContain('서울특별시 강남구 강남대로 396')
  })

  it('카테고리에 따라 올바른 Material 아이콘을 표시하는지 확인', () => {
    const wrapper = mount(FacilityCard, {
      props: { facility: mockFacility },
    })

    // Material Icon 'wc' for toilet category
    expect(wrapper.html()).toContain('wc')
    expect(wrapper.find('.material-symbols-outlined').exists()).toBe(true)
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

  it('카테고리별 Material 아이콘이 표시되는지 확인', () => {
    const categories = [
      { category: 'toilet' as const, icon: 'wc' },
      { category: 'wifi' as const, icon: 'wifi' },
      { category: 'trash' as const, icon: 'delete' },
      { category: 'clothes' as const, icon: 'checkroom' },
      { category: 'kiosk' as const, icon: 'account_balance' },
    ]

    categories.forEach(({ category, icon }) => {
      const facility = { ...mockFacility, category }
      const wrapper = mount(FacilityCard, {
        props: { facility },
      })

      expect(wrapper.html()).toContain(icon)
      expect(wrapper.find('.material-symbols-outlined').exists()).toBe(true)
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
})
