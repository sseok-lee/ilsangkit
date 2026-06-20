import { describe, it, expect } from 'vitest'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'

describe('shouldNoindexSsr', () => {
  it('positiveNoindex(지번 등 적극증거)면 fetchFailed/confirmedEmpty 무관하게 noindex', () => {
    expect(shouldNoindexSsr({ positiveNoindex: true, fetchFailed: true, confirmedEmpty: false })).toBe(true)
    expect(shouldNoindexSsr({ positiveNoindex: true, fetchFailed: false, confirmedEmpty: false })).toBe(true)
  })

  it('일시 실패(fetchFailed)면 절대 noindex 안 함 (회귀 핵심)', () => {
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: true })).toBe(false)
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: false })).toBe(false)
  })

  it('진짜 빈값(confirmedEmpty)이고 실패 아니면 noindex', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: true })).toBe(true)
  })

  it('전부 아니면 색인(false)', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: false })).toBe(false)
  })
})

describe('shouldNoindexSsr — 지역목록 의미 매핑', () => {
  it('fetch 실패면 total 0이어도 noindex 금지', () => {
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: true })).toBe(false)
  })
  it('성공 + 진짜 0건이면 noindex 유지(thin)', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: true })).toBe(true)
  })
})
