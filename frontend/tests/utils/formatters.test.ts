import { describe, expect, it } from 'vitest'
import { formatKoreanPrice } from '../../utils/formatters'

describe('formatKoreanPrice', () => {
  it('rounds decimal 만원 values before rendering', () => {
    expect(formatKoreanPrice(23766.667)).toBe('2억 3,767만원')
  })

  it('carries rounded 만원 values into 억 units', () => {
    expect(formatKoreanPrice(9999.6)).toBe('1억')
  })
})
