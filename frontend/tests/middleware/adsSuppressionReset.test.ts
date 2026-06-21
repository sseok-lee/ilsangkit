import { afterEach, describe, expect, it } from 'vitest'
import resetMiddleware from '~/middleware/ads-suppression-reset.global'
import { suppressAds, useAdsPolicy } from '~/composables/useAdsPolicy'

afterEach(() => { (globalThis as any).__resetUseState?.() })

describe('ads-suppression-reset global middleware', () => {
  it('내비게이션 시 ads:suppressed 를 false 로 리셋해 광고를 복구한다', () => {
    suppressAds(true)
    expect(useAdsPolicy().shouldServeAds.value).toBe(false)
    ;(resetMiddleware as () => void)()
    expect(useAdsPolicy().shouldServeAds.value).toBe(true)
  })
})
