import { describe, it, expect } from 'vitest'
import { RENT_TYPES, LH_RENTAL_TYPES, RENT_GROUP_META, subscriptionTypeBadge, PUBLIC_RENT_TYPES } from '~/utils/subscriptionMeta'

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

describe('subscriptionTypeBadge', () => {
  it('APT 분양(rentType null)은 아파트(인디고)', () => {
    const b = subscriptionTypeBadge('APT', null)
    expect(b.label).toBe('아파트')
    expect(b.kind).toBe('sale')
    expect(b.classes).toContain('indigo')
  })

  it('OFFITEL은 오피스텔(틸)', () => {
    const b = subscriptionTypeBadge('OFFITEL', null)
    expect(b.label).toBe('오피스텔')
    expect(b.classes).toContain('teal')
  })

  it('REMAINING은 무순위·잔여(오렌지)', () => {
    const b = subscriptionTypeBadge('REMAINING', null)
    expect(b.label).toBe('무순위·잔여')
    expect(b.classes).toContain('orange')
  })

  it('OPTIONAL은 임의공급(퍼플)', () => {
    const b = subscriptionTypeBadge('OPTIONAL', null)
    expect(b.label).toBe('임의공급')
    expect(b.classes).toContain('fuchsia')
  })

  it('APT + 공공임대 rentType은 공공임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('APT', PUBLIC_RENT_TYPES[0])
    expect(b.label).toBe('공공임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })

  it('PRIVATE_RENT는 민간임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('PRIVATE_RENT', null)
    expect(b.label).toBe('민간임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })
})
