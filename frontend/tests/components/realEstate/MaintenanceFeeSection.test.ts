import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MaintenanceFeeSection from '~/components/realEstate/MaintenanceFeeSection.vue'
import type { MaintenanceFeeSummary } from '~/types/housingRedesign'
import gaepo from '../../fixtures/maintenanceFeeGaepo.json'

const FEE = gaepo as MaintenanceFeeSummary
const SOURCE = '출처: 국토교통부 K-apt 공동주택관리정보시스템 · 단지 전체 부과액 ÷ 세대수(세대 평균, 평형별 실제 부과액과 다름)'

const mountFee = (fee: Partial<MaintenanceFeeSummary> = {}) =>
  mount(MaintenanceFeeSection, { props: { fee: { ...FEE, ...fee } } })

describe('MaintenanceFeeSection', () => {
  it('제목·부제·세대 평균 큰 숫자·구성 범례·출처', () => {
    const text = mountFee().text()
    expect(text).toContain('관리비')
    expect(text).toContain('K-apt 관리비 공개 · 2026년 8월 부과분')
    expect(text).toContain('세대 평균 월 관리비')
    expect(text).toContain('44만 4,578원')
    expect(text).toMatch(/공용관리비\s*17만 3,395원/)
    expect(text).toMatch(/개별사용료\s*25만 2,105원/)
    expect(text).toMatch(/장기수선충당금\s*1만 9,078원/)
    expect(text).toContain(SOURCE)
  })

  it('여름·겨울·연평균 칸, 값 없는 칸은 숨긴다', () => {
    const seasons = mountFee().findAll('[data-testid="fee-season"]')
    expect(seasons.map((s) => s.text())).toEqual([
      expect.stringContaining('여름'), expect.stringContaining('겨울'), expect.stringContaining('연평균'),
    ])
    expect(seasons[0].text()).toContain('43만 5,664원')
    expect(seasons[0].text()).toContain('26.7~8')
    expect(mountFee({ winter: null }).findAll('[data-testid="fee-season"]')).toHaveLength(2)
  })

  it('월별 막대 13개, 일부만 올라온 달은 흐리게, 최고·최저 요약', () => {
    const wrapper = mountFee()
    const bars = wrapper.findAll('[data-testid="fee-month-bar"]')
    expect(bars).toHaveLength(13)
    expect(bars.at(-1)!.classes()).toContain('opacity-40')
    expect(wrapper.text()).toContain('가장 높은 달 1월 49만 1,205원 · 가장 낮은 달 5월 36만 6,597원')
  })

  it('㎡당 공용관리비 비교, 없으면 블록이 없다', () => {
    const block = mountFee().find('[data-testid="fee-per-m2"]')
    expect(block.text()).toContain('이 단지')
    expect(block.text()).toContain('1,626원')
    expect(block.text()).toContain('같은 시군구 중간(178단지)')
    expect(block.text()).toContain('1,527원')
    expect(mountFee({ commonPerM2: null }).find('[data-testid="fee-per-m2"]').exists()).toBe(false)
  })

  it('항목별 내역은 닫힌 <details> 안에 있어도 HTML 에 들어 있다', () => {
    const details = mountFee().find('details')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.find('summary').text()).toContain('항목별 내역 보기')
    expect(details.text()).toContain('경비비')
    expect(details.text()).toContain('전기료')
  })

  it('관리사무소 전화는 tel 링크, 없으면 블록이 없다', () => {
    const tel = mountFee({ office: { phone: '02) 575-1234', address: '서울' } }).find('a[href^="tel:"]')
    expect(tel.attributes('href')).toBe('tel:02575-1234')
    expect(tel.text()).toBe('02) 575-1234')
    const digits = mountFee({ office: { phone: '0314414250', address: null } }).find('a[href^="tel:"]')
    expect(digits.attributes('href')).toBe('tel:0314414250')
    expect(digits.text()).toBe('031-441-4250')
    expect(mountFee({ office: { phone: null, address: null } }).find('[data-testid="fee-office"]').exists()).toBe(false)
  })
})
