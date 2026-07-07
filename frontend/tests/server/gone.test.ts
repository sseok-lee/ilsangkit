import { describe, it, expect } from 'vitest'

// middleware/gone.ts 와 동일한 매칭 로직 — h3 런타임 의존 회피
const GONE_PREFIXES = ['/kiosk/', '/public-rental/', '/lh-rental/']
const GONE_SUFFIXES = ['/kiosk', '/public-rental', '/lh-rental']

function isGone(path: string): boolean {
  return (
    GONE_PREFIXES.some((p) => path.startsWith(p)) ||
    GONE_SUFFIXES.some((s) => path.endsWith(s))
  )
}

describe('gone middleware — public-rental 410', () => {
  it('공공임대 허브/목록/상세를 410 처리한다', () => {
    expect(isGone('/public-rental')).toBe(true)
    expect(isGone('/public-rental/buy-lease')).toBe(true)
    expect(isGone('/public-rental/charter')).toBe(true)
    expect(isGone('/public-rental/announcements')).toBe(true)
    expect(isGone('/public-rental/announcements/2024010012345')).toBe(true)
  })

  it('레거시 /lh-rental 경로를 410 처리한다', () => {
    expect(isGone('/lh-rental')).toBe(true)
    expect(isGone('/lh-rental/buy-lease')).toBe(true)
  })

  it('청약 경로는 절대 410 처리하지 않는다', () => {
    expect(isGone('/subscription')).toBe(false)
    expect(isGone('/subscription/rent')).toBe(false)
    expect(isGone('/subscription/rent/public')).toBe(false)
    expect(isGone('/subscription/12345')).toBe(false)
  })

  it('기존 kiosk 제거 동작을 유지한다', () => {
    expect(isGone('/kiosk')).toBe(true)
    expect(isGone('/kiosk/seoul')).toBe(true)
  })
})
