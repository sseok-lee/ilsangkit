import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityDetail from '~/components/facility/FacilityDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import ToiletDetail from '~/components/facility/details/ToiletDetail.vue'
import HospitalDetail from '~/components/facility/details/HospitalDetail.vue'
import type { FacilityDetail as FacilityDetailType, FacilityCategory } from '~/types/facility'

function makeFacility(category: FacilityCategory, details: Record<string, unknown> = {}): FacilityDetailType {
  return {
    id: `${category}-1`,
    category,
    name: '테스트 시설',
    address: '서울특별시 강남구',
    roadAddress: null,
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    bjdCode: null,
    details: details as FacilityDetailType['details'],
    sourceId: 'src-1',
    sourceUrl: null,
    viewCount: 0,
    createdAt: '',
    updatedAt: '',
    syncedAt: '',
  }
}

const globalConfig = {
  components: { DetailRow },
}

describe('FacilityDetail wrapper', () => {
  it('renders the toilet detail component for "toilet"', () => {
    const wrapper = mount(FacilityDetail, {
      props: {
        facility: makeFacility('toilet', { operatingHours: '24시간', maleToilets: 3 }),
      },
      global: globalConfig,
    })
    expect(wrapper.findComponent(ToiletDetail).exists()).toBe(true)
    expect(wrapper.findComponent(HospitalDetail).exists()).toBe(false)
    expect(wrapper.text()).toContain('운영시간')
  })

  it('renders nothing for trash (separate route)', () => {
    const wrapper = mount(FacilityDetail, {
      props: { facility: makeFacility('trash') },
      global: globalConfig,
    })
    expect(wrapper.findComponent(ToiletDetail).exists()).toBe(false)
    expect(wrapper.html().trim()).toBe('<!--v-if-->')
  })

  it('does not render its own H1 — page owns the heading', () => {
    const wrapper = mount(FacilityDetail, {
      props: { facility: makeFacility('toilet', { operatingHours: '24시간' }) },
      global: globalConfig,
    })
    expect(wrapper.find('h1').exists()).toBe(false)
  })
})
