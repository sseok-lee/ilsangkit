import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SubscriptionScheduleTimeline from '~/components/subscription/SubscriptionScheduleTimeline.vue'

// TimelineItem 의 날짜 포맷은 그 컴포넌트의 책임이므로, 여기서는 raw 패스스루 스텁으로
// "어떤 행이 어떤 날짜로 렌더되는가"(게이트 로직)만 검증한다.
const TimelineItem = {
  props: ['title', 'date', 'icon', 'isLast'],
  template: '<div class="tl-item"><span class="tl-title">{{ title }}</span><span class="tl-date">{{ date }}</span></div>',
}

function mountWith(sub: Record<string, unknown>) {
  return mount(SubscriptionScheduleTimeline, {
    props: { subscription: sub as never },
    global: { stubs: { TimelineItem } },
  })
}

const base = {
  announcementDate: '2026-05-26',
  receptionStartDate: null,
  receptionEndDate: null,
  specialStartDate: null,
  specialEndDate: null,
  rank1AreaStartDate: null,
  rank1AreaEndDate: null,
  rank2AreaStartDate: null,
  rank2AreaEndDate: null,
  winnerDate: '2026-06-05',
  contractStartDate: '2026-06-06',
  contractEndDate: '2026-06-06',
  moveInMonth: '202812',
}

describe('SubscriptionScheduleTimeline', () => {
  it('순위/특공 데이터가 없으면 일반 "청약 접수" 행을 접수 기간으로 렌더한다', () => {
    const w = mountWith({ ...base, receptionStartDate: '2026-05-26', receptionEndDate: '2026-06-04' })
    const text = w.text()
    expect(text).toContain('모집공고')
    expect(text).toContain('청약 접수')
    expect(text).toContain('2026-05-26 ~ 2026-06-04')
    expect(text).toContain('당첨자 발표')
    expect(text).toContain('계약 기간')
    // 순위/특공 행은 데이터 없으니 미렌더
    expect(text).not.toContain('1순위 접수')
    expect(text).not.toContain('2순위 접수')
    expect(text).not.toContain('특별공급 접수')
  })

  it('순위 데이터가 있으면(APT) "청약 접수"는 숨기고 순위/특공 행을 렌더한다', () => {
    const w = mountWith({
      ...base,
      receptionStartDate: '2026-05-26',
      receptionEndDate: '2026-06-04',
      specialStartDate: '2026-05-26', specialEndDate: '2026-05-26',
      rank1AreaStartDate: '2026-05-27', rank1AreaEndDate: '2026-05-27',
      rank2AreaStartDate: '2026-05-28', rank2AreaEndDate: '2026-05-28',
    })
    const text = w.text()
    expect(text).toContain('특별공급 접수')
    expect(text).toContain('1순위 접수')
    expect(text).toContain('2순위 접수')
    // 일반 청약 접수 행은 순위 데이터 있을 때 숨김(중복 방지)
    expect(text).not.toContain('청약 접수')
  })

  it('특별공급 데이터만 있어도 일반 "청약 접수"는 숨긴다(게이트 경계)', () => {
    const w = mountWith({
      ...base,
      receptionStartDate: '2026-05-26', receptionEndDate: '2026-06-04',
      specialStartDate: '2026-05-26', specialEndDate: '2026-05-26',
    })
    const text = w.text()
    expect(text).toContain('특별공급 접수')
    expect(text).not.toContain('청약 접수')
  })

  it('종료일이 없으면(무순위 상시 접수) 시작일만으로 "청약 접수" 행을 렌더한다', () => {
    const w = mountWith({ ...base, receptionStartDate: '2026-05-26', receptionEndDate: null })
    const text = w.text()
    expect(text).toContain('청약 접수')
    expect(text).toContain('2026-05-26')
    expect(text).not.toContain('2026-05-26 ~')
  })

  it('입주월(YYYYMM)을 "YYYY년 M월"로 포맷한다', () => {
    const w = mountWith({ ...base, receptionStartDate: '2026-05-26', receptionEndDate: '2026-06-04' })
    expect(w.text()).toContain('2028년 12월')
  })
})
