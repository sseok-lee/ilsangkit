import { describe, it, expect } from 'vitest'
import { sanitizeLabel } from '../../server/routes/og-map.get'

describe('sanitizeLabel', () => {
  it('한글 평문 그대로 유지', () => {
    expect(sanitizeLabel('새한A')).toBe('새한A')
  })
  it('파이프(|) 제거', () => {
    expect(sanitizeLabel('새한|A')).toBe('새한A')
  })
  it('콜론(:) 제거', () => {
    expect(sanitizeLabel('a:b')).toBe('ab')
  })
  it('연속 공백 1개로 압축', () => {
    expect(sanitizeLabel('a   b')).toBe('a b')
  })
  it('양쪽 공백 제거', () => {
    expect(sanitizeLabel('  공백  ')).toBe('공백')
  })
  it('21자 → 20자 자름', () => {
    const input = 'a'.repeat(21)
    expect(sanitizeLabel(input)).toHaveLength(20)
  })
  it('undefined → undefined', () => {
    expect(sanitizeLabel(undefined)).toBeUndefined()
  })
  it('빈 문자열 → undefined', () => {
    expect(sanitizeLabel('')).toBeUndefined()
  })
  it('공백만 → undefined', () => {
    expect(sanitizeLabel('   ')).toBeUndefined()
  })
})
