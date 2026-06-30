import { describe, it, expect } from 'vitest'
import { resolveFacilityPhone } from '~/utils/facilityPhone'

describe('resolveFacilityPhone', () => {
  it('우선순위: phoneNumber > phone > clerkTel > crtelno > busiCall', () => {
    expect(resolveFacilityPhone({ phoneNumber: '1', phone: '2' })).toBe('1')
    expect(resolveFacilityPhone({ phone: '2', clerkTel: '3' })).toBe('2')
    expect(resolveFacilityPhone({ clerkTel: '3', crtelno: '4' })).toBe('3')
    expect(resolveFacilityPhone({ crtelno: '4', busiCall: '5' })).toBe('4')
    expect(resolveFacilityPhone({ busiCall: '5' })).toBe('5')
  })
  it('없으면 null', () => {
    expect(resolveFacilityPhone({})).toBeNull()
    expect(resolveFacilityPhone(undefined)).toBeNull()
    expect(resolveFacilityPhone(null)).toBeNull()
  })
})
