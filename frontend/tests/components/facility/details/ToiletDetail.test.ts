import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ToiletDetail from '~/components/facility/details/ToiletDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { ToiletDetails } from '~/types/facility'

describe('ToiletDetail', () => {
  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: ToiletDetails = {
      operatingHours: '24시간',
      maleToilets: 3,
      maleUrinals: 5,
      femaleToilets: 5,
      hasDisabledToilet: true,
      openTime: '24시간',
      managingOrg: '서울시',
    }

    const wrapper = mount(ToiletDetail, {
      props: { details },
      global: {
        components: {
          DetailRow,
        },
      },
    })

    expect(wrapper.text()).toContain('24시간')
    expect(wrapper.text()).toContain('3개')
    expect(wrapper.text()).toContain('5개')
    expect(wrapper.text()).toContain('서울시')
  })

  it('null/undefined 필드는 렌더링하지 않음', () => {
    const details: ToiletDetails = {
      operatingHours: '24시간',
      maleToilets: 3,
      femaleToilets: 5,
      hasDisabledToilet: true,
      // openTime, managingOrg null
    }

    const wrapper = mount(ToiletDetail, {
      props: { details },
      global: {
        components: {
          DetailRow,
        },
      },
    })

    expect(wrapper.text()).toContain('24시간')
    expect(wrapper.text()).toContain('3개')
    expect(wrapper.text()).toContain('5개')
  })

  it('장애인 화장실 여부 표시', () => {
    const detailsWithDisabled: ToiletDetails = {
      hasDisabledToilet: true,
      maleToilets: 3,
      femaleToilets: 5,
    }

    const wrapperWith = mount(ToiletDetail, {
      props: { details: detailsWithDisabled },
      global: {
        components: {
          DetailRow,
        },
      },
    })

    expect(wrapperWith.text()).toContain('있음')

    const detailsWithoutDisabled: ToiletDetails = {
      hasDisabledToilet: false,
      maleToilets: 3,
      femaleToilets: 5,
    }

    const wrapperWithout = mount(ToiletDetail, {
      props: { details: detailsWithoutDisabled },
      global: {
        components: {
          DetailRow,
        },
      },
    })

    expect(wrapperWithout.text()).toContain('없음')
  })

  it('빈 문자열도 숨김 처리', () => {
    const details: ToiletDetails = {
      operatingHours: '',
      maleToilets: 3,
      femaleToilets: 5,
    }

    const wrapper = mount(ToiletDetail, {
      props: { details },
      global: {
        components: {
          DetailRow,
        },
      },
    })

    // operatingHours 레이블이 표시되지 않아야 함
    expect(wrapper.html()).not.toContain('운영시간')
  })
})
