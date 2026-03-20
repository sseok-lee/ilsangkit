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
      phoneNumber: '02-1234-5678',
      coeducationType: '남여공학',
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
    expect(wrapper.text()).toContain('02-1234-5678')
    expect(wrapper.text()).toContain('남여공학')
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

    expect(wrapper.text()).not.toContain('설립일')
    expect(wrapper.text()).not.toContain('연락처')
    expect(wrapper.text()).not.toContain('홈페이지')
    expect(wrapper.text()).not.toContain('학급 현황')
    expect(wrapper.text()).not.toContain('학과 정보')
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

  it('전화번호 tel: 링크 렌더링', () => {
    const details: SchoolDetails = {
      phoneNumber: '02-1234-5678',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[href="tel:02-1234-5678"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('02-1234-5678')
  })

  it('홈페이지 외부 링크 렌더링 (http 없는 URL에 http:// 추가)', () => {
    const details: SchoolDetails = {
      homepageUrl: 'www.school.kr',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('http://www.school.kr')
  })

  it('홈페이지 https URL은 그대로 유지', () => {
    const details: SchoolDetails = {
      homepageUrl: 'https://school.kr',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    const link = wrapper.find('a[target="_blank"]')
    expect(link.attributes('href')).toBe('https://school.kr')
  })

  it('고교유형 배지 표시', () => {
    const details: SchoolDetails = {
      schoolLevel: '고등학교',
      highSchoolType: '특성화고',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.find('.bg-violet-100').exists()).toBe(true)
    expect(wrapper.text()).toContain('특성화고')
  })

  it('남녀공학 배지 표시', () => {
    const details: SchoolDetails = {
      schoolLevel: '초등학교',
      coeducationType: '남여공학',
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.find('.bg-indigo-100').exists()).toBe(true)
    expect(wrapper.text()).toContain('남여공학')
  })

  it('학급 현황 테이블 렌더링', () => {
    const details: SchoolDetails = {
      schoolLevel: '중학교',
      enrollments: [
        { grade: 1, classCount: 8 },
        { grade: 2, classCount: 7 },
        { grade: 3, classCount: 8 },
      ],
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('학급 현황')
    expect(wrapper.text()).toContain('1학년')
    expect(wrapper.text()).toContain('2학년')
    expect(wrapper.text()).toContain('3학년')
    expect(wrapper.text()).toContain('합계')
    expect(wrapper.text()).toContain('8개')
    // 합계행: 8+7+8=23
    expect(wrapper.text()).toContain('23개')
  })

  it('학과 정보 (특성화고) 태그 렌더링', () => {
    const details: SchoolDetails = {
      schoolLevel: '고등학교',
      highSchoolType: '특성화고',
      departments: [
        { departmentName: '기계과' },
        { departmentName: '전자과' },
        { departmentName: '자동차과' },
      ],
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('학과 정보')
    expect(wrapper.text()).toContain('기계과')
    expect(wrapper.text()).toContain('전자과')
    expect(wrapper.text()).toContain('자동차과')
    expect(wrapper.findAll('.bg-sky-100')).toHaveLength(3)
  })

  it('enrollment/department 빈 배열이면 섹션 숨김', () => {
    const details: SchoolDetails = {
      schoolLevel: '초등학교',
      enrollments: [],
      departments: [],
    }

    const wrapper = mount(SchoolDetail, {
      props: { details },
      ...globalConfig,
    })

    expect(wrapper.text()).not.toContain('학급 현황')
    expect(wrapper.text()).not.toContain('학과 정보')
  })
})
