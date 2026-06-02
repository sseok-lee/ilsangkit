import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FieldGrid from '~/components/facility/detail/FieldGrid.vue'

describe('FieldGrid', () => {
  it('값 있는 셀을 렌더한다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, items: [{ label: '정원', value: 50, unit: '명' }] } })
    expect(w.text()).toContain('정원')
    expect(w.text()).toContain('50')
    expect(w.text()).toContain('명')
  })
  it('alwaysShow=true면 빈 값도 "정보 없음"으로 렌더한다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, alwaysShow: true, items: [{ label: 'CCTV', value: null, unit: '대' }] } })
    expect(w.text()).toContain('CCTV')
    expect(w.text()).toContain('정보 없음')
  })
  it('alwaysShow=false면 빈 값 셀은 숨긴다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, items: [{ label: 'CCTV', value: null, unit: '대' }] } })
    expect(w.text()).not.toContain('CCTV')
  })
})
