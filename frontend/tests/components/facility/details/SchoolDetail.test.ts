import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SchoolDetail from '~/components/facility/details/SchoolDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { SchoolDetails } from '~/types/facility'

describe('SchoolDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: SchoolDetails = {
      schoolLevel: '초등학교',
      foundationType: '공립',
      foundedDate: '1980-03-01',
      sidoEduName: '서울특별시교육청',
      localEduName: '강남서초교육지원청',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('초등학교')
    expect(wrapper.text()).toContain('공립')
    expect(wrapper.text()).toContain('1980-03-01')
    expect(wrapper.text()).toContain('서울특별시교육청')
    expect(wrapper.text()).toContain('강남서초교육지원청')
  })

  it('operationStatus는 표시하지 않음', () => {
    const details: SchoolDetails = {
      schoolLevel: '초등학교',
      operationStatus: '운영',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.html()).not.toContain('운영 현황')
  })

  it('초등학교 배지 색상 (green)', () => {
    const details: SchoolDetails = { schoolLevel: '초등학교' }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-green-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('초등학교')
  })

  it('중학교 배지 색상 (blue)', () => {
    const details: SchoolDetails = { schoolLevel: '중학교' }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('중학교')
  })

  it('고등학교 배지 색상 (purple)', () => {
    const details: SchoolDetails = { schoolLevel: '고등학교' }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const badge = wrapper.find('.bg-purple-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('고등학교')
  })

  it('foundationType 뱃지: 공립=blue, 사립=purple, 국립=red', () => {
    const publicSchool = mount(SchoolDetail, {
      props: { details: { schoolLevel: '초등학교', foundationType: '공립' } },
      ...globalConfig,
    })
    // schoolLevel=초등(green) + foundationType=공립(blue)
    expect(publicSchool.find('.bg-green-100').exists()).toBe(true)
    expect(publicSchool.find('.bg-blue-100').exists()).toBe(true)

    const privateSchool = mount(SchoolDetail, {
      props: { details: { schoolLevel: '초등학교', foundationType: '사립' } },
      ...globalConfig,
    })
    expect(privateSchool.find('.bg-purple-100').exists()).toBe(true)

    const nationalSchool = mount(SchoolDetail, {
      props: { details: { schoolLevel: '초등학교', foundationType: '국립' } },
      ...globalConfig,
    })
    expect(nationalSchool.find('.bg-red-100').exists()).toBe(true)
  })

  it('branchType: 분교일 때만 주황색 뱃지 표시', () => {
    const branchSchool = mount(SchoolDetail, {
      props: { details: { schoolLevel: '초등학교', branchType: '분교' } },
      ...globalConfig,
    })
    expect(branchSchool.find('.bg-orange-100').exists()).toBe(true)
    expect(branchSchool.text()).toContain('분교')

    const mainSchool = mount(SchoolDetail, {
      props: { details: { schoolLevel: '초등학교', branchType: '본교' } },
      ...globalConfig,
    })
    expect(mainSchool.find('.bg-orange-100').exists()).toBe(false)
  })

  it('null/undefined 필드 숨김 처리', () => {
    const details: SchoolDetails = {
      schoolLevel: '초등학교',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.html()).not.toContain('설립일')
    expect(wrapper.html()).not.toContain('관할교육청')
  })

  it('교육청 정보 섹션: sidoEduName 있을 때 표시', () => {
    const details: SchoolDetails = {
      sidoEduName: '서울특별시교육청',
      localEduName: '강남서초교육지원청',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('서울특별시교육청')
    expect(wrapper.text()).toContain('강남서초교육지원청')
  })
})
