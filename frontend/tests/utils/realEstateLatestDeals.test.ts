import { describe, expect, it } from 'vitest'
import type { DealSnapshot, LatestDeals } from '~/types/realEstateExploration'
import { formatDealDate, selectRepresentativeDeal } from '~/utils/realEstateLatestDeals'

const sale = (overrides: Partial<DealSnapshot> = {}): DealSnapshot => ({
  kind: 'sale',
  amount: 125000,
  deposit: null,
  monthlyRent: null,
  exclusiveArea: 84.92,
  floor: 12,
  dealYear: 2026,
  dealMonth: 8,
  dealDay: 20,
  ...overrides,
})

const jeonse = (overrides: Partial<DealSnapshot> = {}): DealSnapshot => ({
  kind: 'jeonse',
  amount: null,
  deposit: 70000,
  monthlyRent: null,
  exclusiveArea: 59.98,
  floor: 8,
  dealYear: 2026,
  dealMonth: 8,
  dealDay: 20,
  ...overrides,
})

const wolse = (overrides: Partial<DealSnapshot> = {}): DealSnapshot => ({
  kind: 'wolse',
  amount: null,
  deposit: 10000,
  monthlyRent: 120,
  exclusiveArea: 59.98,
  floor: 9,
  dealYear: 2026,
  dealMonth: 8,
  dealDay: 20,
  ...overrides,
})

describe('realEstateLatestDeals', () => {
  it('formats a null deal day as a contract month without inventing day 1', () => {
    expect(formatDealDate(sale({ dealDay: null }))).toBe('2026.08 계약')
  })

  it('formats a known deal day with two-digit month and day', () => {
    expect(formatDealDate(jeonse({ dealMonth: 3, dealDay: 4 }))).toBe('2026.03.04 계약')
  })

  it('returns null when every latest-deal slot is empty', () => {
    const bundle: LatestDeals = { sale: null, jeonse: null, wolse: null }
    expect(selectRepresentativeDeal(bundle)).toBeNull()
  })

  it('chooses the latest month across sale, jeonse, and wolse', () => {
    const newer = wolse({ dealMonth: 9, dealDay: null })
    const bundle: LatestDeals = {
      sale: sale({ dealMonth: 8, dealDay: 31 }),
      jeonse: jeonse({ dealMonth: 7, dealDay: 31 }),
      wolse: newer,
    }
    expect(selectRepresentativeDeal(bundle)).toBe(newer)
  })

  it('treats a known day as more precise than an unknown day in the same month', () => {
    const preciseJeonse = jeonse({ dealDay: 1 })
    const bundle: LatestDeals = {
      sale: sale({ dealDay: null }),
      jeonse: preciseJeonse,
      wolse: wolse({ dealDay: null }),
    }
    expect(selectRepresentativeDeal(bundle)).toBe(preciseJeonse)
  })

  it('uses sale, jeonse, wolse order only when dates are exactly tied', () => {
    const tiedSale = sale({ dealDay: 20 })
    const bundle: LatestDeals = {
      sale: tiedSale,
      jeonse: jeonse({ dealDay: 20 }),
      wolse: wolse({ dealDay: 20 }),
    }
    expect(selectRepresentativeDeal(bundle)).toBe(tiedSale)
  })

  it('does not compare source ids across deal kinds', () => {
    const tiedJeonse = jeonse({ dealDay: 20 })
    const bundle: LatestDeals = {
      sale: null,
      jeonse: tiedJeonse,
      wolse: wolse({ dealDay: 20 }),
    }
    expect(selectRepresentativeDeal(bundle)).toBe(tiedJeonse)
  })
})
