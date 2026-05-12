import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailFacilityStatus from '~/components/facility/detail/DetailFacilityStatus.vue'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

function makeFacility(category: FacilityCategory, details: Record<string, unknown>): FacilityDetail {
  return {
    id: `${category}-1`,
    category,
    name: '테스트 시설',
    address: '서울특별시 강남구 강남대로 100',
    roadAddress: '서울특별시 강남구 강남대로 100',
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
    SectionBlock: { template: '<section data-testid="status-section"><slot /></section>' },
    EvChargerDetail: { template: '<div data-testid="ev-charger-detail" />' },
  },
}

describe('DetailFacilityStatus — 카테고리 메타데이터 제거 회귀', () => {
  it('school: 시설현황에 연락처/팩스/홈페이지/교육청 행이 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('school', {
          phoneNumber: '02-111-2222',
          faxNumber: '02-111-3333',
          homepageUrl: 'http://example.kr',
          sidoEduName: '서울시교육청',
          localEduName: '강남교육지원청',
          schoolLevel: '초등학교',
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('02-111-2222')
    expect(html).not.toContain('02-111-3333')
    expect(html).not.toContain('example.kr')
    expect(html).not.toContain('서울시교육청')
    expect(html).not.toContain('강남교육지원청')
  })

  it('park: 시설현황에 공원유형/지정일/관리기관/연락처 행이 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('park', {
          parkType: '근린공원',
          designatedDate: '20100101',
          managingOrg: '구청',
          phoneNumber: '02-222-3333',
          area: 1000,
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('근린공원')
    expect(html).not.toContain('02-222-3333')
    expect(html).not.toContain('구청')
    expect(html).toContain('1,000')
  })

  it('pharmacy: pharmacistCnt 있으면 시설현황 노출', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('pharmacy', { pharmacistCnt: 3 }),
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('약사')
    expect(wrapper.text()).toContain('3')
  })

  it('hospital: 시설현황에 요일별 진료시간 표/홈페이지가 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('hospital', {
          trmtMonStart: '0900',
          trmtMonEnd: '1800',
          homepage: 'http://hospital.example',
          drTotCnt: 5,
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('요일별 진료시간')
    expect(html).not.toContain('hospital.example')
    expect(html).toContain('의료진')
  })

  it('aed: 시설현황에 요일별 이용시간 표/담당자 연락처가 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('aed', {
          monSttTme: '0900',
          monEndTme: '1800',
          clerkTel: '010-1111-2222',
          buildPlace: '1층 로비',
          mfg: 'CU',
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('요일별 이용시간')
    expect(html).not.toContain('010-1111-2222')
    expect(html).toContain('1층 로비')
    expect(html).toContain('CU')
  })
})
