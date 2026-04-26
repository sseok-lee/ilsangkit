import { describe, it, expect } from 'vitest'
import { RENT_TYPES, LH_RENTAL_TYPES, RENT_GROUP_META } from '~/utils/subscriptionMeta'

describe('subscriptionMeta descriptions', () => {
  it('RENT_TYPES 공공임대·민간임대 description이 50자 이상이다', () => {
    expect(RENT_TYPES.public.description.length).toBeGreaterThanOrEqual(50)
    expect(RENT_TYPES.private.description.length).toBeGreaterThanOrEqual(50)
  })

  it('LH_RENTAL_TYPES description이 모두 60자 이상이다', () => {
    Object.values(LH_RENTAL_TYPES).forEach(meta => {
      expect(meta.description.length).toBeGreaterThanOrEqual(60)
    })
  })

  it('RENT_GROUP_META description이 50자 이상이다', () => {
    Object.values(RENT_GROUP_META).forEach(meta => {
      expect(meta.description.length).toBeGreaterThanOrEqual(50)
    })
  })
})
