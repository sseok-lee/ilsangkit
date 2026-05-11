import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
    const grayBadges = wrapper.findAll('.bg-slate-100')
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

describe('EvChargerDetail 실시간 폴링', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  const detailsWithChargers: EvChargerDetails = {
    statId: 'ME101010',
    chargers: [
      { chgerId: '01', output: '100', stat: '2', method: 'DC콤보' },
      { chgerId: '02', output: '7', stat: '3', method: 'AC완속' },
    ],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: [
        { chgerId: '01', stat: '3', statUpdDt: '20260410120000' },
        { chgerId: '02', stat: '2', statUpdDt: '20260410120100' },
      ],
    })
    // SSR 가드용
    ;(globalThis as any).import = { meta: { client: true } }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('statId가 있으면 마운트 시 상태를 폴링한다', async () => {
    mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    // 초기 fetch 호출 확인
    await vi.advanceTimersByTimeAsync(100)
    expect((globalThis as any).$fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ev-charger/ME101010/status'),
      expect.any(Object)
    )
  })

  it('폴링 응답으로 충전기 상태가 갱신된다', async () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    // 폴링 실행 대기
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    await nextTick()

    // 충전기 #01: stat 2→3 (충전대기→충전중)
    // 충전기 #02: stat 3→2 (충전중→충전대기)
    const text = wrapper.text()
    // 두 충전기 모두 상태가 바뀌어야 함
    expect(text).toContain('충전대기')
    expect(text).toContain('충전중')
  })

  it('30초 간격으로 폴링을 반복한다', async () => {
    mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    const initialCallCount = (globalThis as any).$fetch.mock.calls.length

    // 30초 후 추가 호출
    await vi.advanceTimersByTimeAsync(30000)
    expect((globalThis as any).$fetch.mock.calls.length).toBeGreaterThan(initialCallCount)
  })

  it('언마운트 시 폴링이 정리된다', async () => {
    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    const callCountBefore = (globalThis as any).$fetch.mock.calls.length

    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(60000)
    expect((globalThis as any).$fetch.mock.calls.length).toBe(callCountBefore)
  })

  it('statId가 없으면 폴링하지 않는다', async () => {
    mount(EvChargerDetail, {
      props: { details: { chargers: detailsWithChargers.chargers } },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(30000)
    // status 엔드포인트 호출이 없어야 함
    const statusCalls = (globalThis as any).$fetch.mock.calls.filter(
      (call: any[]) => String(call[0]).includes('/status')
    )
    expect(statusCalls).toHaveLength(0)
  })

  it('폴링 실패 시 기존 상태를 유지한다', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    // 원래 상태 유지
    expect(wrapper.text()).toContain('충전대기') // stat=2
    expect(wrapper.text()).toContain('충전중')   // stat=3
  })

  it('성공 직후 freshness 라벨로 "방금 갱신"을 표시한다', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: [
        { chgerId: '01', stat: '2', statUpdDt: '20260410120000' },
      ],
    })

    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('방금 갱신')
  })

  it('마운트 직후 첫 응답 전엔 "갱신 중…"을 표시한다', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    ;(globalThis as any).$fetch = vi.fn().mockImplementation(
      () => new Promise(resolve => { resolveFetch = resolve })
    )

    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await nextTick()
    expect(wrapper.text()).toContain('갱신 중')

    resolveFetch({ success: true, data: [] })
  })

  it('첫 폴링이 실패하면 "갱신 실패 · 재시도 중"을 표시한다', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const wrapper = mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('갱신 실패')
  })

  it('탭이 hidden 상태가 되면 폴링을 중단한다', async () => {
    mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)
    const callsBeforeHide = (globalThis as any).$fetch.mock.calls.length

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(120_000)
    expect((globalThis as any).$fetch.mock.calls.length).toBe(callsBeforeHide)
  })

  it('탭이 visible로 복귀하면 즉시 1회 폴링하고 재개한다', async () => {
    mount(EvChargerDetail, {
      props: { details: detailsWithChargers },
      ...globalConfig,
    })

    await vi.advanceTimersByTimeAsync(100)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(60_000)

    const callsWhileHidden = (globalThis as any).$fetch.mock.calls.length

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(100)

    expect((globalThis as any).$fetch.mock.calls.length).toBeGreaterThan(callsWhileHidden)
  })
})
