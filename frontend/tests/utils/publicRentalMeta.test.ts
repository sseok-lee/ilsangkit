import { describe, it, expect } from 'vitest'
import {
  fmtArea,
  fmtCount,
  fmtCompletionDate,
  fmtText,
  fmtDeposit,
  fmtRent,
  isJeonseRental,
  rentalTypeToSlug,
  NO_DATA,
} from '~/utils/publicRentalMeta'

describe('publicRentalMeta formatters', () => {
  it('fmtArea returns 정보없음 for null/undefined', () => {
    expect(fmtArea(null)).toBe(NO_DATA)
    expect(fmtArea(undefined)).toBe(NO_DATA)
    expect(fmtArea(49.5)).toBe('49.5㎡')
  })

  it('fmtCount formats with locale + unit; null → 정보없음', () => {
    expect(fmtCount(1234, '세대')).toBe('1,234세대')
    expect(fmtCount(null, '대')).toBe(NO_DATA)
  })

  it('fmtCompletionDate parses YYYYMMDD; invalid → 정보없음', () => {
    expect(fmtCompletionDate('20180615')).toBe('2018.06.15')
    expect(fmtCompletionDate(null)).toBe(NO_DATA)
    expect(fmtCompletionDate('1234')).toBe(NO_DATA)
  })

  it('fmtText returns 정보없음 for empty/null/whitespace', () => {
    expect(fmtText(null)).toBe(NO_DATA)
    expect(fmtText('')).toBe(NO_DATA)
    expect(fmtText('   ')).toBe(NO_DATA)
    expect(fmtText('아파트')).toBe('아파트')
  })

  it('fmtDeposit formats 만원 / 억원 boundaries', () => {
    expect(fmtDeposit(0)).toBe('0원')
    expect(fmtDeposit(50_000_000)).toBe('5,000만원')
    expect(fmtDeposit(120_000_000)).toBe('1억 2,000만원')
    expect(fmtDeposit(100_000_000)).toBe('1억원')
    expect(fmtDeposit(null)).toBe(NO_DATA)
  })

  it('fmtRent returns "없음 (전세)" when isJeonse', () => {
    expect(fmtRent(0, true)).toBe('없음 (전세)')
    expect(fmtRent(180_000, false)).toBe('18만원')
    expect(fmtRent(0, false)).toBe('없음 (전세)')
    expect(fmtRent(null, false)).toBe(NO_DATA)
  })

  it('isJeonseRental treats 0/null/undefined as 전세', () => {
    expect(isJeonseRental(0)).toBe(true)
    expect(isJeonseRental(null)).toBe(true)
    expect(isJeonseRental(undefined)).toBe(true)
    expect(isJeonseRental(180_000)).toBe(false)
  })

  it('rentalTypeToSlug maps 매입임대/전세임대 → slugs', () => {
    expect(rentalTypeToSlug('매입임대')).toBe('buy-lease')
    expect(rentalTypeToSlug('전세임대')).toBe('charter')
    expect(rentalTypeToSlug('국민임대')).toBeNull()
  })
})
