import { describe, it, expect } from 'vitest'
import { SUBSCRIPTION_HUB_DESCRIPTION } from '~/utils/subscriptionMeta'

describe('SUBSCRIPTION_HUB_DESCRIPTION', () => {
  it('80자 이상 160자 이하다', () => {
    expect(SUBSCRIPTION_HUB_DESCRIPTION.length).toBeGreaterThanOrEqual(80)
    expect(SUBSCRIPTION_HUB_DESCRIPTION.length).toBeLessThanOrEqual(160)
  })

  it('청약·분양·임대 키워드를 포함한다', () => {
    const hasKeywords = ['청약', '분양', '임대'].every(kw =>
      SUBSCRIPTION_HUB_DESCRIPTION.includes(kw)
    )
    expect(hasKeywords).toBe(true)
  })
})
