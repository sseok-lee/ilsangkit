import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityList from '~/components/facility/FacilityList.vue'

describe('FacilityList', () => {
  const mockFacilities = [
    {
      id: 'toilet-1',
      name: '강남역 지하 공중화장실',
      category: 'toilet' as const,
      address: '서울특별시 강남구 강남대로 396',
      lat: 37.4979,
      lng: 127.0276,
      distance: 150,
    },
    {
      id: 'wifi-1',
      name: '강남구청 무료와이파이',
      category: 'wifi' as const,
      address: '서울특별시 강남구 학동로 426',
      lat: 37.5172,
      lng: 127.0473,
      distance: 300,
    },
  ]

  it('시설 목록을 올바르게 렌더링하는지 확인', () => {
    const wrapper = mount(FacilityList, {
      props: { facilities: mockFacilities, loading: false },
      global: {
        stubs: {
          FacilityCard: {
            template: '<div class="facility-card">{{ facility.name }}</div>',
            props: ['facility'],
          },
        },
      },
    })

    expect(wrapper.findAll('.facility-card')).toHaveLength(2)
  })

  it('로딩 중일 때 스켈레톤을 표시하는지 확인', () => {
    const wrapper = mount(FacilityList, {
      props: { facilities: [], loading: true },
    })

    // 스켈레톤 UI 확인
    expect(wrapper.find('[data-testid="skeleton"]').exists() || wrapper.html().toContain('skeleton')).toBe(true)
  })

  it('시설이 없을 때 빈 상태를 표시하는지 확인', () => {
    const wrapper = mount(FacilityList, {
      props: { facilities: [], loading: false },
    })

    expect(wrapper.text()).toContain('검색 결과가 없습니다')
  })

  it('시설이 있을 때 빈 상태를 표시하지 않는지 확인', () => {
    const wrapper = mount(FacilityList, {
      props: { facilities: mockFacilities, loading: false },
      global: {
        stubs: {
          FacilityCard: {
            template: '<div class="facility-card"></div>',
            props: ['facility'],
          },
        },
      },
    })

    expect(wrapper.text()).not.toContain('검색 결과가 없습니다')
  })

  it('로딩이 끝나고 시설이 없을 때만 빈 상태를 표시하는지 확인', () => {
    const loadingWrapper = mount(FacilityList, {
      props: { facilities: [], loading: true },
    })

    const emptyWrapper = mount(FacilityList, {
      props: { facilities: [], loading: false },
    })

    expect(loadingWrapper.text()).not.toContain('검색 결과가 없습니다')
    expect(emptyWrapper.text()).toContain('검색 결과가 없습니다')
  })
})
