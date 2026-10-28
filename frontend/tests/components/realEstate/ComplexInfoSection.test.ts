import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComplexInfoSection from '~/components/realEstate/ComplexInfoSection.vue'
import type { ComplexInfo } from '~/types/housingRedesign'

const GAEPO: ComplexInfo = {
  matchType: 'address',
  kaptCode: 'A13580602',
  name: '개포경남아파트',
  householdCount: 678,
  dongCount: 9,
  topFloor: 15,
  basementFloors: 0,
  useApprovalDate: '1984-03-08',
  totalParking: 747,
  groundParking: 747,
  undergroundParking: 0,
  heatingType: '지역난방',
  corridorType: '계단식',
  builder: '경남건설',
  developer: '경남건설',
  managementType: '위탁관리',
  saleType: '분양',
  elevatorCount: 26,
  cctvCount: 102,
  evChargerCount: 9,
  areas: [
    [84.6, 2], [84.725, 1], [91.91, 29], [96.98, 166], [123.28, 192], [149.21, 59],
    [149.57, 1], [166.48, 48], [182.11, 1], [182.2, 149], [186.16, 30],
  ].map(([exclusiveArea, householdCount]) => ({ exclusiveArea, householdCount })),
  sourceDate: '2026-10-26',
}

describe('ComplexInfoSection', () => {
  it('제목·기준일·표 9줄·면적 막대·출처를 렌더한다', () => {
    const wrapper = mount(ComplexInfoSection, { props: { complex: GAEPO } })
    const text = wrapper.text()
    expect(text).toContain('단지 정보')
    expect(text).toContain('K-apt 공동주택관리정보 · 2026.10.26. 기준')
    expect(wrapper.findAll('dt').map((dt) => dt.text())).toEqual([
      '세대수 · 동수', '층수', '사용승인', '주차', '난방 · 복도', '시공 · 시행', '관리 · 분양', '승강기 · CCTV', '전기차 충전',
    ])
    expect(text).toContain('678세대 · 9개 동')
    expect(wrapper.findAll('[data-testid="complex-info-areas"] li')).toHaveLength(6)
    expect(text).toContain('출처: 국토교통부 K-apt 공동주택관리정보시스템 · 관리비 공개 의무단지만 제공')
  })

  it('값 없는 줄과 빈 면적 목록은 렌더하지 않고, 기준일이 없으면 부제만', () => {
    const wrapper = mount(ComplexInfoSection, {
      props: { complex: { ...GAEPO, evChargerCount: null, heatingType: null, corridorType: null, areas: [], sourceDate: null } },
    })
    const labels = wrapper.findAll('dt').map((dt) => dt.text())
    expect(labels).not.toContain('전기차 충전')
    expect(labels).not.toContain('난방 · 복도')
    expect(wrapper.find('[data-testid="complex-info-areas"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('K-apt 공동주택관리정보')
    expect(wrapper.text()).not.toContain('기준')
  })
})
