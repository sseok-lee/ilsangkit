import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailBasicInfo from '~/components/facility/detail/DetailBasicInfo.vue'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({
    trackPhoneClick: vi.fn(),
    trackDirectionsClick: vi.fn(),
    trackShareClick: vi.fn(),
    trackFacilityView: vi.fn(),
  }),
}))

function makeFacility(category: FacilityCategory, details: Record<string, unknown>): FacilityDetail {
  return {
    id: `${category}-1`,
    category,
    name: '테스트 시설',
    address: '서울특별시 강남구 강남대로 100',
    roadAddress: '서울특별시 강남구 강남대로 100 (역삼동)',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    bjdCode: null,
    details: details as FacilityDetail['details'],
    sourceId: 'src-1',
    sourceUrl: null,
    viewCount: 0,
    createdAt: '',
    updatedAt: '',
    syncedAt: '',
  }
}

const globalConfig = {
  stubs: {
    ClientOnly: { template: '<div><slot /></div>' },
    OperatingStatusBanner: { template: '<div data-testid="operating-status-banner" />' },
    SectionBlock: { template: '<section><slot /></section>' },
  },
}

const baseProps = {
  hospitalOperatingHours: [],
  hospitalWeeklyHours: [],
  hospitalWeeklyHoursCount: 0,
  aedOperatingHours: [],
  aedWeeklyHours: [],
  aedWeeklyHoursCount: 0,
  pharmacyWeeklyHours: [],
}

describe('DetailBasicInfo', () => {
  it('도로명 주소를 우선 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('toilet', { operatingHours: '24시간' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('서울특별시 강남구 강남대로 100 (역삼동)')
  })

  it('운영시간이 24시간이면 운영중 배지 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('toilet', { operatingHours: '24시간', maleToilets: 3 }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('운영중')
  })

  it('hospital + weekly hours 있을 때 BasicInfo의 Operating Hours 행 숨김', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('hospital', { operatingHours: '09:00-18:00', clCdNm: '병원' }),
        ...baseProps,
        hospitalWeeklyHoursCount: 7,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).not.toContain('09:00-18:00')
  })

  it('카테고리별 분기: toilet 시설유형 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('toilet', { facilityType: '공중화장실', managingOrg: '구청' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('공중화장실')
    expect(wrapper.text()).toContain('구청')
  })

  it('phoneNumber/phone/clerkTel 통합 전화 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('parking', { phone: '02-1234-5678', parkingType: '공영' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.html()).toContain('tel:02-1234-5678')
  })

  it('pharmacy는 요일별 운영시간 표(WeekdayHoursTable)를 렌더한다', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('pharmacy', {}),
        ...baseProps,
        pharmacyWeeklyHours: [
          { day: '월', time: '09:00 ~ 18:00', isToday: false, closed: false },
          { day: '일', time: '휴무', isToday: false, closed: true },
        ],
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('요일별 운영시간')
    expect(wrapper.findAll('tbody tr').length).toBeGreaterThanOrEqual(2)
  })

  it('parking: 주차장 유형(lotType)을 기본정보 주차 구분 옆에 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('parking', { parkingType: '공영', lotType: '노외' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('주차장 유형')
    expect(wrapper.text()).toContain('노외')
  })
})
