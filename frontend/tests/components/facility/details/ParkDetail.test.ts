import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ParkDetail from '~/components/facility/details/ParkDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { ParkDetails } from '~/types/facility'

describe('ParkDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: ParkDetails = {
      parkType: '도시공원',
      area: 12345,
      designatedDate: '2010-05-01',
      managingOrg: '서울시 강남구',
      phoneNumber: '02-1234-5678',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('도시공원')
    expect(wrapper.text()).toContain('12,345㎡')
    expect(wrapper.text()).toContain('약 3,734평')
    expect(wrapper.text()).toContain('2010-05-01')
    expect(wrapper.text()).toContain('서울시 강남구')
    expect(wrapper.text()).toContain('02-1234-5678')
  })

  it('area ㎡ + 평수 포맷팅 확인', () => {
    const details: ParkDetails = {
      area: 5000,
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('5,000㎡')
    expect(wrapper.text()).toContain('약 1,513평')
  })

  it('parkType 뱃지 색상: 어린이공원 (green)', () => {
    const details: ParkDetails = {
      parkType: '어린이공원',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-green-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('어린이공원')
  })

  it('parkType 뱃지 색상: 근린공원 (blue)', () => {
    const details: ParkDetails = {
      parkType: '근린공원',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
  })

  it('null/undefined 필드 숨김 처리', () => {
    const details: ParkDetails = {
      parkType: '근린공원',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('근린공원')
    expect(wrapper.html()).not.toContain('관리기관')
    expect(wrapper.html()).not.toContain('연락처')
  })

  it('phoneNumber type="phone" 링크 렌더링', () => {
    const details: ParkDetails = {
      phoneNumber: '02-1234-5678',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[href^="tel:"]')
    expect(link.exists()).toBe(true)
  })

  it('시설 정보: "+" 구분 텍스트를 태그 칩으로 렌더링', () => {
    const details: ParkDetails = {
      exerciseFacilities: '배드민턴장+농구장',
      playFacilities: '그네+조합놀이',
      convenienceFacilities: '음수대+벤치',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    // 카테고리별 제목 + 태그 칩으로 분리되어 렌더링
    expect(wrapper.text()).toContain('운동시설')
    expect(wrapper.text()).toContain('놀이시설')
    expect(wrapper.text()).toContain('편의시설')
    expect(wrapper.text()).toContain('배드민턴장')
    expect(wrapper.text()).toContain('농구장')
    expect(wrapper.text()).toContain('그네')
    expect(wrapper.text()).toContain('조합놀이')
    expect(wrapper.text()).toContain('음수대')
    expect(wrapper.text()).toContain('벤치')
  })

  it('시설 섹션: 모두 없을 때 숨김', () => {
    const details: ParkDetails = {
      parkType: '도시공원',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.html()).not.toContain('운동시설')
    expect(wrapper.html()).not.toContain('놀이시설')
  })

  it('cultureFacilities: 값 있을 때만 표시', () => {
    const details: ParkDetails = {
      cultureFacilities: '야외공연장+전시관',
    }

    const wrapper = mount(ParkDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('교양시설')
    expect(wrapper.text()).toContain('야외공연장')
    expect(wrapper.text()).toContain('전시관')
  })
})
