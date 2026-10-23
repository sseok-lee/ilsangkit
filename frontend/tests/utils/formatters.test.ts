import { describe, expect, it } from 'vitest'
import { buildYearLabel, formatKoreanPrice, formatKstDate } from '../../utils/formatters'

describe('formatKoreanPrice', () => {
  it('rounds decimal 만원 values before rendering', () => {
    expect(formatKoreanPrice(23766.667)).toBe('2억 3,767만원')
  })

  it('carries rounded 만원 values into 억 units', () => {
    expect(formatKoreanPrice(9999.6)).toBe('1억')
  })

  it('formats zero', () => {
    expect(formatKoreanPrice(0)).toBe('0만원')
  })

  it('formats a plain integer under 1억 (no round needed)', () => {
    expect(formatKoreanPrice(5000)).toBe('5,000만원')
  })

  it('formats exactly at the 억 boundary (no round needed)', () => {
    expect(formatKoreanPrice(10000)).toBe('1억')
  })

  it('formats 억 + 만 combination for an integer input (no round needed)', () => {
    // 기지 사실: search.vue의 구 formatRealEstatePrice(정수 dealAmount 입력)와 byte-identical.
    // 15억 3,000만원 (153000 → uk=15, man=3000) — round는 정수 입력에서 no-op.
    expect(formatKoreanPrice(153000)).toBe('15억 3,000만원')
  })
})

describe('formatKstDate', () => {
  it('returns null for nullish input', () => {
    expect(formatKstDate(null)).toBeNull()
    expect(formatKstDate(undefined)).toBeNull()
    expect(formatKstDate('')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(formatKstDate('not-a-date')).toBeNull()
  })

  it('renders KST date when sync completed at 03:00 KST (UTC previous day)', () => {
    // KST 2026-05-07 03:00 = UTC 2026-05-06 18:00
    expect(formatKstDate('2026-05-06T18:00:00.000Z')).toBe('2026-05-07')
  })

  it('renders KST date when sync completed at 09:00 KST (UTC same day boundary)', () => {
    // KST 2026-05-07 09:00 = UTC 2026-05-07 00:00
    expect(formatKstDate('2026-05-07T00:00:00.000Z')).toBe('2026-05-07')
  })

  it('renders KST date when sync completed late afternoon KST', () => {
    // KST 2026-05-07 18:00 = UTC 2026-05-07 09:00
    expect(formatKstDate('2026-05-07T09:00:00.000Z')).toBe('2026-05-07')
  })
})

describe('buildYearLabel', () => {
  it('연차를 병기한다', () => {
    expect(buildYearLabel(2018, 2026)).toBe('2018년 (8년차)')
  })

  it('당해 준공(연차 0 이하)은 연도만', () => {
    expect(buildYearLabel(2026, 2026)).toBe('2026년')
    expect(buildYearLabel(2027, 2026)).toBe('2027년') // 미래 데이터 방어
  })

  it('buildYear 없으면 null', () => {
    expect(buildYearLabel(null, 2026)).toBeNull()
    expect(buildYearLabel(undefined, 2026)).toBeNull()
  })
})
