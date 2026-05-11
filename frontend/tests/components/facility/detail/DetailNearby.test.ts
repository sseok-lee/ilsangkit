import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailNearby from '~/components/facility/detail/DetailNearby.vue'
import type { Facility } from '~/types/facility'

const makeFacility = (id: string, name: string, category: Facility['category'] = 'toilet'): Facility => ({
  id,
  name,
  category,
  address: '서울특별시 강남구',
  roadAddress: null,
  lat: 37.5,
  lng: 127.0,
  city: '서울',
  district: '강남구',
  distance: 100,
})

const globalConfig = {
  stubs: {
    SectionBlock: { template: '<section><h3 v-if="heading">{{ heading }}</h3><slot /></section>', props: ['heading', 'subtext'] },
    FacilityCard: { template: '<div data-testid="facility-card">{{ facility.name }}</div>', props: ['facility', 'highlightDistance'] },
  },
}

describe('DetailNearby', () => {
  it('same-category nearby와 cross-category nearby를 함께 렌더링', () => {
    const wrapper = mount(DetailNearby, {
      props: {
        nearbyFacilities: [makeFacility('a', '가까운 화장실 A')],
        nearbyLoading: false,
        crossFacilitiesGrouped: [
          {
            category: 'parking',
            meta: { label: '주차장', icon: 'local_parking' },
            items: [makeFacility('p1', '근처 주차장', 'parking')],
          },
        ],
        crossLoading: false,
        categoryMeta: { label: '화장실', icon: 'wc' },
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('주변 화장실')
    expect(wrapper.text()).toContain('가까운 화장실 A')
    expect(wrapper.text()).toContain('주변 주차장')
    expect(wrapper.text()).toContain('근처 주차장')
  })

  it('nearby 결과 없으면 same-category 섹션 미렌더', () => {
    const wrapper = mount(DetailNearby, {
      props: {
        nearbyFacilities: [],
        nearbyLoading: false,
        crossFacilitiesGrouped: [],
        crossLoading: false,
        categoryMeta: { label: '화장실' },
      },
      global: globalConfig,
    })
    expect(wrapper.text()).not.toContain('주변 화장실')
  })

  it('loading 상태에서 skeleton 표시', () => {
    const wrapper = mount(DetailNearby, {
      props: {
        nearbyFacilities: [],
        nearbyLoading: true,
        crossFacilitiesGrouped: [],
        crossLoading: true,
        categoryMeta: { label: '화장실' },
      },
      global: globalConfig,
    })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})
