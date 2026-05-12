import { describe, it, expect } from 'vitest'
import { buildHeroBadge } from '~/utils/facilityHeroMeta'

describe('buildHeroBadge', () => {
  it('returns null for categories without meaningful operating status', () => {
    expect(buildHeroBadge({ category: 'wifi', details: { operationStatus: '운영' } } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'clothes', details: {} } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'parking', details: { operatingHours: '24시간' } } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'ev-charger', details: {} } as any)).toBeNull()
  })

  it('returns open24h for 24h pharmacy', () => {
    expect(buildHeroBadge({
      category: 'pharmacy',
      details: { operatingHours: '24시간' },
    } as any)).toBe('open24h')
  })

  it('returns null when status cannot be determined', () => {
    expect(buildHeroBadge({ category: 'pharmacy', details: {} } as any)).toBeNull()
  })

  it('delegates to getOperatingStatus for supported categories', () => {
    expect(buildHeroBadge({
      category: 'aed',
      details: { is24Hour: true },
    } as any)).toBe('open24h')
  })
})
