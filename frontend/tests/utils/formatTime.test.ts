import { describe, it, expect } from 'vitest'
import { formatHHMM } from '~/utils/formatTime'

describe('formatHHMM', () => {
  it('should convert "900" to "09:00"', () => {
    expect(formatHHMM('900')).toBe('09:00')
  })

  it('should convert "1930" to "19:30"', () => {
    expect(formatHHMM('1930')).toBe('19:30')
  })

  it('should convert number 2000 to "20:00"', () => {
    expect(formatHHMM(2000)).toBe('20:00')
  })

  it('should return time as-is if it already has colon', () => {
    expect(formatHHMM('09:00')).toBe('09:00')
  })

  it('should return empty string for empty string', () => {
    expect(formatHHMM('')).toBe('')
  })

  it('should return empty string for null', () => {
    expect(formatHHMM(null)).toBe('')
  })

  it('should return empty string for undefined', () => {
    expect(formatHHMM(undefined)).toBe('')
  })

  it('should handle number 900 as input', () => {
    expect(formatHHMM(900)).toBe('09:00')
  })

  it('should trim whitespace before processing', () => {
    expect(formatHHMM('  900  ')).toBe('09:00')
  })
})
