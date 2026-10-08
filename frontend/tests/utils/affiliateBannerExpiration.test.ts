import { describe, expect, it } from 'vitest'
import { getAffiliateExpiryWindow } from '~/utils/affiliateBannerExpiration'

describe('affiliate expiry response timing', () => {
  const serverTime = '2026-10-15T14:59:59.000Z'
  const expiry = '2026-10-15T15:00:00.000Z'

  it('accounts conservatively for request duration', () => {
    expect(getAffiliateExpiryWindow(expiry, serverTime, 250)).toEqual({ remainingMs: 750 })
    expect(getAffiliateExpiryWindow(expiry, serverTime, 1000)).toBeNull()
    expect(getAffiliateExpiryWindow(null, serverTime, 250)).toEqual({ remainingMs: null })
  })

  it('rejects incomplete or normalized metadata', () => {
    expect(getAffiliateExpiryWindow(undefined, serverTime, 0)).toBeNull()
    expect(getAffiliateExpiryWindow(expiry, undefined, 0)).toBeNull()
    expect(getAffiliateExpiryWindow('2026-02-30T15:00:00.000Z', serverTime, 0)).toBeNull()
  })

  it('rejects invalid request timing', () => {
    expect(getAffiliateExpiryWindow(expiry, serverTime, Number.NaN)).toBeNull()
    expect(getAffiliateExpiryWindow(expiry, serverTime, -1)).toBeNull()
  })

  it('rejects browser-normalized and local date strings', () => {
    expect(getAffiliateExpiryWindow('2026-10-15T15:00:00Z', serverTime, 0)).toBeNull()
    expect(getAffiliateExpiryWindow('2026-10-15T15:00:00.000+09:00', serverTime, 0)).toBeNull()
    expect(getAffiliateExpiryWindow('2026-10-15', serverTime, 0)).toBeNull()
  })
})
