import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChildcareDetail from '~/components/facility/details/ChildcareDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { ChildcareDetails } from '~/types/facility'

describe('ChildcareDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  it('crtypename 뱃지: 국공립=blue', () => {
    const details: ChildcareDetails = { crtypename: '국공립' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('국공립')
  })

  it('crtypename 뱃지: 민간=orange', () => {
    const details: ChildcareDetails = { crtypename: '민간어린이집' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-orange-100')
    expect(badge.exists()).toBe(true)
  })

  it('crtypename 뱃지: 가정=green', () => {
    const details: ChildcareDetails = { crtypename: '가정어린이집' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-green-100')
    expect(badge.exists()).toBe(true)
  })

  it('crtypename 뱃지: 직장=purple', () => {
    const details: ChildcareDetails = { crtypename: '직장어린이집' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-purple-100')
    expect(badge.exists()).toBe(true)
  })

  it('crtypename 뱃지: 협동=teal', () => {
    const details: ChildcareDetails = { crtypename: '협동어린이집' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-teal-100')
    expect(badge.exists()).toBe(true)
  })

  it('crstatusname 뱃지: 운영=green', () => {
    const details: ChildcareDetails = { crstatusname: '운영' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-green-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('운영')
  })

  it('crstatusname 뱃지: 휴지=yellow', () => {
    const details: ChildcareDetails = { crstatusname: '휴지' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-yellow-100')
    expect(badge.exists()).toBe(true)
  })

  it('crstatusname 뱃지: 폐지=red', () => {
    const details: ChildcareDetails = { crstatusname: '폐지' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-red-100')
    expect(badge.exists()).toBe(true)
  })

  it('crcapat/crchcnt 정원·현원 및 가용률 표시', () => {
    const details: ChildcareDetails = { crcapat: 100, crchcnt: 70 }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('70')
    expect(wrapper.text()).toContain('30%')
  })

  it('cctvinstlcnt CCTV 수 표시', () => {
    const details: ChildcareDetails = { cctvinstlcnt: 5 }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('CCTV')
    expect(wrapper.text()).toContain('5')
  })

  it('nrtrroomcnt 보육실 수 표시', () => {
    const details: ChildcareDetails = { nrtrroomcnt: 3 }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('보육실')
    expect(wrapper.text()).toContain('3')
  })

  it('crcargbname 통학차량 표시', () => {
    const details: ChildcareDetails = { crcargbname: '운행' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('통학차량')
    expect(wrapper.text()).toContain('운행')
  })

  it('crtelno type="phone" 링크 렌더링', () => {
    const details: ChildcareDetails = { crtelno: '02-1234-5678' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const link = wrapper.find('a[href^="tel:"]')
    expect(link.exists()).toBe(true)
  })

  it('crhome 외부 링크 target="_blank"', () => {
    const details: ChildcareDetails = { crhome: 'https://example.com' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com')
  })

  it('crcnfmdt 인가일 표시', () => {
    const details: ChildcareDetails = { crcnfmdt: '2015-03-01' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('인가일')
    expect(wrapper.text()).toContain('2015-03-01')
  })

  it('chcrtescnt 교직원 수 표시', () => {
    const details: ChildcareDetails = { chcrtescnt: 8 }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('교직원')
    expect(wrapper.text()).toContain('8')
  })

  it('null 필드 숨김 처리', () => {
    const details: ChildcareDetails = { crtypename: '국공립' }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).not.toContain('인가일')
    expect(wrapper.text()).not.toContain('CCTV')
    expect(wrapper.text()).not.toContain('통학차량')
  })

  it('휴지 상태 시 crpausebegindt~crpauseenddt 기간 표시', () => {
    const details: ChildcareDetails = {
      crstatusname: '휴지',
      crpausebegindt: '2024-01-01',
      crpauseenddt: '2024-06-30',
    }
    const wrapper = mount(ChildcareDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('2024-01-01')
    expect(wrapper.text()).toContain('2024-06-30')
  })
})
