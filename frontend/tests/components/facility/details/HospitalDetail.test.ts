import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HospitalDetail from '~/components/facility/details/HospitalDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { HospitalDetails } from '~/types/facility'

describe('HospitalDetail', () => {
  it('모든 필드가 있을 때 올바르게 렌더링', () => {
    const details: HospitalDetails = {
      clCdNm: '의원',
      phone: '02-1234-5678',
      estbDd: '2020-01-15',
      homepage: 'https://example-hospital.com',
      drTotCnt: 5,
      mdeptSdrCnt: 3,
      pnursCnt: 10,
    }

    const wrapper = mount(HospitalDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    expect(wrapper.text()).toContain('의원')
    expect(wrapper.text()).toContain('02-1234-5678')
    expect(wrapper.text()).toContain('2020-01-15')
    expect(wrapper.text()).toContain('5명')
    expect(wrapper.text()).toContain('3명')
    expect(wrapper.text()).toContain('10명')
    expect(wrapper.text()).toContain('https://example-hospital.com')
  })

  it('null/undefined 필드는 렌더링하지 않음', () => {
    const details: HospitalDetails = {
      clCdNm: '의원',
      phone: null,
      estbDd: null,
      homepage: null,
      drTotCnt: null,
    }

    const wrapper = mount(HospitalDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    expect(wrapper.text()).toContain('의원')
    expect(wrapper.text()).not.toContain('전화번호')
    expect(wrapper.text()).not.toContain('개설일자')
    expect(wrapper.text()).not.toContain('홈페이지')
    expect(wrapper.text()).not.toContain('의료진 현황')
  })

  it('홈페이지 링크가 target="_blank"로 렌더링', () => {
    const details: HospitalDetails = {
      homepage: 'https://example-hospital.com',
    }

    const wrapper = mount(HospitalDetail, {
      props: { details },
      global: {
        components: { DetailRow },
      },
    })

    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example-hospital.com')
    expect(link.attributes('rel')).toContain('noopener')
  })
})
