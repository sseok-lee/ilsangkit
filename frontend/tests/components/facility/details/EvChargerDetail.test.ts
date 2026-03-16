import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EvChargerDetail from '~/components/facility/details/EvChargerDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { EvChargerDetails } from '~/types/facility'

describe('EvChargerDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  const fullDetails: EvChargerDetails = {
    statId: 'ME101010',
    useTime: '24시간',
    busiNm: '한국전력공사',
    busiCall: '02-1234-5678',
    parkingFree: 'Y',
    limitYn: 'N',
    addrDetail: '1층',
    location: '주차장 입구',
    note: '우천 시 이용 불가',
    year: '2022',
    chargers: [
      { chgerId: '01', output: '100', stat: '2', method: 'DC콤보', maker: '현대이노시스' },
      { chgerId: '02', output: '7', stat: '3', method: 'AC완속', maker: '시그넷이브이' },
      { chgerId: '03', output: '50', stat: '4', method: 'DC차데모', maker: '현대이노시스' },
    ],
  }

  it('충전기 요약 뱃지: 총 N대, 급속 N대, 완속 N대', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: fullDetails },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('총 3대')
    expect(wrapper.text()).toContain('급속 2대')
    expect(wrapper.text()).toContain('완속 1대')
  })

  it('충전소 기본 정보 표시: 이용시간, 운영기관, 설치년도', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: fullDetails },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('24시간')
    expect(wrapper.text()).toContain('한국전력공사')
    expect(wrapper.text()).toContain('2022년')
  })

  it('운영기관 연락처 type="phone" 렌더링', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: fullDetails },
      ...globalConfig,
    })

    const link = wrapper.find('a[href^="tel:"]')
    expect(link.exists()).toBe(true)
  })

  it('parkingFree Y → 무료주차 ✓ 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { parkingFree: 'Y' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('✓')
    expect(wrapper.text()).toContain('무료주차')
  })

  it('parkingFree N → 유료주차 ✗ 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { parkingFree: 'N' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('✗')
    expect(wrapper.text()).toContain('유료주차')
  })

  it('limitYn Y → 이용제한 있음 + limitDetail 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { limitYn: 'Y', limitDetail: '입주민 전용' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('이용제한 있음')
    expect(wrapper.text()).toContain('입주민 전용')
  })

  it('limitYn N → 이용제한 없음 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { limitYn: 'N' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('이용제한 없음')
  })

  it('위치 정보: addrDetail, location 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { addrDetail: 'B1 주차장', location: '지하 1층 출구 옆' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('B1 주차장')
    expect(wrapper.text()).toContain('지하 1층 출구 옆')
  })

  it('안내사항(note) 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { note: '우천 시 이용 불가' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('우천 시 이용 불가')
  })

  it('충전기 목록: 각 충전기별 타입/출력/상태 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: fullDetails },
      ...globalConfig,
    })

    // 충전기 #01: 급속 100kW 충전대기
    expect(wrapper.text()).toContain('#01')
    expect(wrapper.text()).toContain('100kW')
    expect(wrapper.text()).toContain('충전대기')

    // 충전기 #02: 완속 7kW 충전중
    expect(wrapper.text()).toContain('#02')
    expect(wrapper.text()).toContain('7kW')
    expect(wrapper.text()).toContain('충전중')

    // 충전기 #03: 급속 50kW 운영중지
    expect(wrapper.text()).toContain('#03')
    expect(wrapper.text()).toContain('50kW')
    expect(wrapper.text()).toContain('운영중지')
  })

  it('충전기 상태 뱃지 색상: 충전대기=green, 충전중=yellow, 운영중지=red', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: fullDetails },
      ...globalConfig,
    })

    expect(wrapper.find('.bg-green-100').exists()).toBe(true)
    expect(wrapper.find('.bg-yellow-100').exists()).toBe(true)
    expect(wrapper.find('.bg-red-100').exists()).toBe(true)
  })

  it('충전기 타입 뱃지: 급속=blue, 완속=green', () => {
    const wrapper = mount(EvChargerDetail, {
      props: {
        details: {
          chargers: [
            { chgerId: '01', output: '100', stat: '2' },
            { chgerId: '02', output: '7', stat: '2' },
          ],
        },
      },
      ...globalConfig,
    })

    expect(wrapper.find('.bg-blue-100').exists()).toBe(true)
    expect(wrapper.find('.bg-green-100').exists()).toBe(true)
  })

  it('충전기 통신이상(stat=1), 상태미확인(stat=9) → gray', () => {
    const wrapper = mount(EvChargerDetail, {
      props: {
        details: {
          chargers: [
            { chgerId: '01', output: '50', stat: '1' },
            { chgerId: '02', output: '50', stat: '9' },
          ],
        },
      },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('통신이상')
    expect(wrapper.text()).toContain('상태미확인')
    const grayBadges = wrapper.findAll('.bg-gray-100')
    expect(grayBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('충전기 method(충전방식) 표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: {
        details: {
          chargers: [{ chgerId: '01', output: '100', stat: '2', method: 'DC콤보' }],
        },
      },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('DC콤보')
  })

  it('null/undefined 필드 숨김 처리', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { busiNm: '테스트기관' } },
      ...globalConfig,
    })

    expect(wrapper.text()).toContain('테스트기관')
    expect(wrapper.html()).not.toContain('이용시간')
    expect(wrapper.html()).not.toContain('설치년도')
    expect(wrapper.html()).not.toContain('충전기 현황')
  })

  it('chargers 빈 배열이면 충전기 목록 미표시', () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: { busiNm: '테스트', chargers: [] } },
      ...globalConfig,
    })

    expect(wrapper.html()).not.toContain('충전기 현황')
  })
})
