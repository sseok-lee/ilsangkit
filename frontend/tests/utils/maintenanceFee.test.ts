import { describe, it, expect } from 'vitest'
import { formatWon, formatFeeMonth, formatFeePeriod, feeExtremes, feeMonthLabel, formatOfficePhone } from '~/utils/maintenanceFee'
import fee from '../fixtures/maintenanceFeeGaepo.json'

describe('formatWon', () => {
  it('만 단위로 끊고 축약하지 않는다', () => {
    expect(formatWon(444578)).toBe('44만 4,578원')
    expect(formatWon(19078)).toBe('1만 9,078원')
    expect(formatWon(1626)).toBe('1,626원')
    expect(formatWon(10000)).toBe('1만원')
    expect(formatWon(1234567)).toBe('123만 4,567원')
    expect(formatWon(0)).toBe('0원')
  })
})

describe('formatFeeMonth / feeMonthLabel', () => {
  it("'YYYY-MM' → '2026년 8월', 막대 라벨 '8월'", () => {
    expect(formatFeeMonth('2026-08')).toBe('2026년 8월')
    expect(feeMonthLabel('2026-01')).toBe('1월')
  })
})

describe('formatFeePeriod', () => {
  it('같은 해는 뒤 연도를 생략한다', () => {
    expect(formatFeePeriod({ from: '2025-12', to: '2026-02' })).toBe('25.12~26.2')
    expect(formatFeePeriod({ from: '2026-07', to: '2026-08' })).toBe('26.7~8')
    expect(formatFeePeriod({ from: '2025-09', to: '2026-08' })).toBe('25.9~26.8')
  })
})

describe('feeExtremes', () => {
  it('일부만 올라온 달은 빼고 가장 높은·낮은 달', () => {
    expect(feeExtremes(fee.monthly)).toEqual({
      high: { month: '2026-01', amount: 491205 },
      low: { month: '2026-05', amount: 366597 },
    })
  })

  it('정상 달이 2개 미만이면 null', () => {
    expect(feeExtremes([{ month: '2026-08', amount: 1, partial: false }, { month: '2026-09', amount: 2, partial: true }])).toBeNull()
  })
})

describe('formatOfficePhone', () => {
  it('숫자만 온 번호에 하이픈을 넣고, 알 수 없는 형식은 그대로 둔다', () => {
    expect(formatOfficePhone('0314414250')).toBe('031-441-4250')
    expect(formatOfficePhone('0220580890')).toBe('02-2058-0890')
    expect(formatOfficePhone('025751234')).toBe('02-575-1234')
    expect(formatOfficePhone('03144142500')).toBe('031-4414-2500')
    expect(formatOfficePhone('15881234')).toBe('1588-1234')
    expect(formatOfficePhone('02) 575-1234')).toBe('02) 575-1234')
  })
})
