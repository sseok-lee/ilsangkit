import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BuildingRegisterSection from '~/components/realEstate/BuildingRegisterSection.vue'
import type { BuildingRegisterInfo } from '~/types/housingRedesign'

const YATAP: BuildingRegisterInfo = {
  kind: 'residential',
  householdCount: 216,
  offitelUnitCount: null,
  dongCount: 9,
  topFloor: 4,
  basementFloors: 1,
  useApprovalDate: '1994-11-08',
  totalParking: 206,
  elevatorCount: 0,
  purposes: ['연립주택'],
  structure: '철근콘크리트구조',
  sourceMonth: '2026-09',
  unitSourceMonth: null,
}

const ACROTEL: BuildingRegisterInfo = {
  ...YATAP,
  kind: 'offitel',
  householdCount: null,
  offitelUnitCount: 471,
  dongCount: 1,
  purposes: ['오피스텔'],
  unitSourceMonth: '2026-09',
}

describe('BuildingRegisterSection', () => {
  it('단지 제목·대장 기준 월·행', () => {
    const wrapper = mount(BuildingRegisterSection, { props: { register: YATAP } })
    expect(wrapper.text()).toContain('단지 정보')
    expect(wrapper.text()).toContain('건축물대장 · 2026년 9월 기준')
    expect(wrapper.findAll('[data-testid="register-info-rows"] > div')).toHaveLength(6)
    expect(wrapper.text()).toContain('216세대 · 9개 동')
    expect(wrapper.text()).toContain('출처: 국토교통부 건축물대장(건축HUB) · 세대수는 대장 기재 기준')
    expect(wrapper.text()).not.toContain('상가 제외')
  })

  it('오피스텔은 건물 제목과 호수 기준 안내', () => {
    const wrapper = mount(BuildingRegisterSection, { props: { register: ACROTEL } })
    expect(wrapper.text()).toContain('건물 정보')
    expect(wrapper.text()).toContain('오피스텔 471호')
    expect(wrapper.text()).toContain('오피스텔 호수는 호별 용도 기준(상가 제외), 2026년 9월 기준')
  })

  it('기준 월이 없으면 부제는 "건축물대장"', () => {
    const wrapper = mount(BuildingRegisterSection, { props: { register: { ...YATAP, sourceMonth: null } } })
    expect(wrapper.text()).toContain('건축물대장')
    expect(wrapper.text()).not.toContain('기준 ·')
  })
})
