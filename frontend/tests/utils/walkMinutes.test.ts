import { describe, it, expect } from 'vitest'
import { walkMinutes } from '~/utils/walkMinutes'

describe('walkMinutes — 직선거리(m) 기준 도보 시간 추정(분속 67m)', () => {
  it('320m → 5분', () => {
    expect(walkMinutes(320)).toBe(5)
  })

  it('26m → 1분 (최소 1분)', () => {
    expect(walkMinutes(26)).toBe(1)
  })

  it('0m 도 1분으로 올린다', () => {
    expect(walkMinutes(0)).toBe(1)
  })

  it('반올림한다 — 2000m → 30분, 100m → 1분, 101m → 2분', () => {
    expect(walkMinutes(2000)).toBe(30)
    expect(walkMinutes(100)).toBe(1)
    expect(walkMinutes(101)).toBe(2)
  })
})
