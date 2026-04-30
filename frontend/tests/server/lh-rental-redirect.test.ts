import { describe, it, expect } from 'vitest'

// middleware/lh-rental-redirect.ts 와 동일한 정규식 — h3 런타임 의존 회피
const SUBSCRIPTION_RENT_PATTERN = /^\/subscription\/rent\/(buy-lease|charter)\/?$/
const LH_RENTAL_TYPE_PATTERN = /^\/lh-rental\/(buy-lease|charter)\/?$/
const LH_RENTAL_HUB_PATTERN = /^\/lh-rental\/?$/
const NEW_PUBLIC_RENTAL = /^\/public-rental(\/.*)?$/

describe('public-rental redirect — SUBSCRIPTION_RENT_PATTERN (legacy /subscription/rent/*)', () => {
  it('matches /subscription/rent/buy-lease', () => {
    expect(SUBSCRIPTION_RENT_PATTERN.test('/subscription/rent/buy-lease')).toBe(true)
    expect(SUBSCRIPTION_RENT_PATTERN.exec('/subscription/rent/buy-lease')?.[1]).toBe('buy-lease')
  })

  it('matches /subscription/rent/charter (with trailing slash)', () => {
    expect(SUBSCRIPTION_RENT_PATTERN.test('/subscription/rent/charter/')).toBe(true)
    expect(SUBSCRIPTION_RENT_PATTERN.exec('/subscription/rent/charter/')?.[1]).toBe('charter')
  })

  it('does NOT match other rent type slugs', () => {
    expect(SUBSCRIPTION_RENT_PATTERN.test('/subscription/rent/public')).toBe(false)
    expect(SUBSCRIPTION_RENT_PATTERN.test('/subscription/rent/private')).toBe(false)
  })

  it('does NOT match deeper nested paths', () => {
    expect(SUBSCRIPTION_RENT_PATTERN.test('/subscription/rent/buy-lease/extra')).toBe(false)
  })
})

describe('public-rental redirect — LH_RENTAL_*_PATTERN (legacy /lh-rental/*)', () => {
  it('LH_RENTAL_TYPE_PATTERN matches /lh-rental/buy-lease and /lh-rental/charter', () => {
    expect(LH_RENTAL_TYPE_PATTERN.test('/lh-rental/buy-lease')).toBe(true)
    expect(LH_RENTAL_TYPE_PATTERN.test('/lh-rental/charter/')).toBe(true)
    expect(LH_RENTAL_TYPE_PATTERN.exec('/lh-rental/buy-lease')?.[1]).toBe('buy-lease')
  })

  it('LH_RENTAL_HUB_PATTERN matches /lh-rental and /lh-rental/', () => {
    expect(LH_RENTAL_HUB_PATTERN.test('/lh-rental')).toBe(true)
    expect(LH_RENTAL_HUB_PATTERN.test('/lh-rental/')).toBe(true)
  })

  it('does NOT match new /public-rental URLs (loop prevention)', () => {
    expect(SUBSCRIPTION_RENT_PATTERN.test('/public-rental/buy-lease')).toBe(false)
    expect(LH_RENTAL_TYPE_PATTERN.test('/public-rental/buy-lease')).toBe(false)
    expect(LH_RENTAL_HUB_PATTERN.test('/public-rental')).toBe(false)
    expect(NEW_PUBLIC_RENTAL.test('/public-rental')).toBe(true)
    expect(NEW_PUBLIC_RENTAL.test('/public-rental/buy-lease')).toBe(true)
  })
})
