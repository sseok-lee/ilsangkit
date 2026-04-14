import { describe, it, expect } from 'vitest'
import { formatDeposit } from '~/utils/formatDeposit'

describe('formatDeposit', () => {
  it('5억원을 "5억"으로 포맷하는지 확인', () => {
    expect(formatDeposit(50000)).toBe('5억')
  })

  it('1억 3000만원을 "1억 3,000만원"으로 포맷하는지 확인', () => {
    expect(formatDeposit(13000)).toBe('1억 3,000만원')
  })

  it('3000만원을 "3,000만원"으로 포맷하는지 확인', () => {
    expect(formatDeposit(3000)).toBe('3,000만원')
  })

  it('0을 "0만원"으로 포맷하는지 확인', () => {
    expect(formatDeposit(0)).toBe('0만원')
  })

  it('999만원을 "999만원"으로 포맷하는지 확인', () => {
    expect(formatDeposit(999)).toBe('999만원')
  })

  it('10000만원(1억)을 "1억"으로 포맷하는지 확인', () => {
    expect(formatDeposit(10000)).toBe('1억')
  })

  it('10500만원(1억 500만원)을 "1억 500만원"으로 포맷하는지 확인', () => {
    expect(formatDeposit(10500)).toBe('1억 500만원')
  })
})
