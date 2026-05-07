import { describe, expect, it } from 'vitest'
import { formatKoreanPrice, formatKstDate } from '../../utils/formatters'

describe('formatKoreanPrice', () => {
  it('rounds decimal 만원 values before rendering', () => {
    expect(formatKoreanPrice(23766.667)).toBe('2억 3,767만원')
  })

  it('carries rounded 만원 values into 억 units', () => {
    expect(formatKoreanPrice(9999.6)).toBe('1억')
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
