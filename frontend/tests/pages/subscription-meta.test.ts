import { describe, it, expect } from 'vitest'
import { SALE_TYPES, SUBSCRIPTION_HUB_DESCRIPTION } from '~/utils/subscriptionMeta'

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

describe('subscription sale type slugs', () => {
  it('무순위·잔여세대 slug는 remaining이며 unrestricted는 쓰지 않는다', () => {
    expect(SALE_TYPES.remaining.sourceType).toBe('REMAINING')
    expect(SALE_TYPES.unrestricted).toBeUndefined()
  })
})
