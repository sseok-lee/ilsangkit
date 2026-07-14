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

  it('ev-charger: useTime을 운영시간으로, busiCall을 전화로 기본정보에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('ev-charger', { useTime: '24시간', busiCall: '1600-1234' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('24시간')
    expect(wrapper.html()).toContain('tel:1600-1234')
  })

  it('childcare: 행정 메타(대표자·팩스)는 muted "기타 정보" 그룹에 남아 SSR에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('childcare', {
          crtypename: '국공립', crrepname: '홍길동', crfaxno: '02-1-2', crcnfmdt: '20100101',
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('기타 정보')
    expect(wrapper.text()).toContain('국공립')   // 분류 유지
    expect(wrapper.text()).toContain('홍길동')   // 기타지만 DOM 유지(크롤러 가시)
    expect(wrapper.text()).toContain('02-1-2')
  })

  it('school: 교육청·팩스가 muted 그룹에 남아 SSR에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('school', {
          schoolLevel: '초등학교', faxNumber: '02-9-9', sidoEduName: '서울시교육청',
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('초등학교')      // 분류 유지
    expect(wrapper.text()).toContain('서울시교육청')   // 기타 DOM 유지
    expect(wrapper.text()).toContain('02-9-9')
  })

  it('parking: managingOrg 없어도 muted 기타 그룹에 관리기관 레이블과 "정보 없음" 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('parking', {
          parkingType: '공영',
          // managingOrg 없음
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('기타 정보')
    expect(wrapper.text()).toContain('관리기관')
    expect(wrapper.text()).toContain('정보 없음')
  })

  it('library: operatingOrg 없어도 libraryType 있으면 muted 기타 그룹에 운영기관 레이블과 "정보 없음" 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('library', {
          libraryType: '공공도서관',
          // operatingOrg 없음
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('기타 정보')
    expect(wrapper.text()).toContain('운영기관')
    expect(wrapper.text()).toContain('정보 없음')
  })

  it('toilet: muted 기타 그룹의 빈 행정 항목을 레이블과 "정보 없음"으로 표시', () => {
    // managingOrg만 있어서 기타 그룹이 렌더됨, installDate·ownershipType은 비어있음
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('toilet', {
          facilityType: '공중화장실',
          managingOrg: '서울시',
          // installDate, ownershipType 없음
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('기타 정보')
    // 빈 행의 레이블이 항상 렌더되어야 함 (fix 전: v-if 실패로 행 전체 숨김)
    expect(wrapper.text()).toContain('설치일')
    expect(wrapper.text()).toContain('소유구분')
  })

  it('hospital: specialtyField 있으면 전문병원 뱃지를 렌더', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('hospital', { specialtyField: '관절', clCdNm: '병원' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    const text = wrapper.text()
    expect(text).toContain('전문병원')
    expect(text).toContain('관절')
  })
})
