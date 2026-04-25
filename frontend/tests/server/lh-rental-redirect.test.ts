import { describe, it, expect } from 'vitest'

// middleware/lh-rental-redirect.ts 와 동일한 정규식 — h3 런타임 의존 회피
const LEGACY_PATTERN = /^\/subscription\/rent\/(buy-lease|charter)\/?$/

describe('LH 임대 redirect — LEGACY_PATTERN', () => {
  it('matches /subscription/rent/buy-lease', () => {
    expect(LEGACY_PATTERN.test('/subscription/rent/buy-lease')).toBe(true)
    expect(LEGACY_PATTERN.exec('/subscription/rent/buy-lease')?.[1]).toBe('buy-lease')
  })

  it('matches /subscription/rent/charter (with trailing slash)', () => {
    expect(LEGACY_PATTERN.test('/subscription/rent/charter/')).toBe(true)
    expect(LEGACY_PATTERN.exec('/subscription/rent/charter/')?.[1]).toBe('charter')
  })

  it('does NOT match other rent type slugs', () => {
    expect(LEGACY_PATTERN.test('/subscription/rent/public')).toBe(false)
    expect(LEGACY_PATTERN.test('/subscription/rent/private')).toBe(false)
  })

  it('does NOT match new /lh-rental URLs (loop prevention)', () => {
    expect(LEGACY_PATTERN.test('/lh-rental/buy-lease')).toBe(false)
    expect(LEGACY_PATTERN.test('/lh-rental/charter')).toBe(false)
    expect(LEGACY_PATTERN.test('/lh-rental')).toBe(false)
  })

  it('does NOT match deeper nested paths', () => {
    expect(LEGACY_PATTERN.test('/subscription/rent/buy-lease/extra')).toBe(false)
  })
})
