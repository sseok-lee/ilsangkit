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

  it('omits subway from badge rendering', () => {
    expect(buildHeroBadge({ category: 'subway', details: {} } as any)).toBeNull()
  })

  it('returns openNow for hospital during opening hours', () => {
    const now = new Date()
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayMap[now.getDay()]
    const start = '0000'
    const end = '2359'
    const result = buildHeroBadge({
      category: 'hospital',
      details: { [`trmt${day}Start`]: start, [`trmt${day}End`]: end },
    } as any)
    expect(result).toBe('openNow')
  })

  it('returns closed for hospital outside opening hours', () => {
    const now = new Date()
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const day = dayMap[now.getDay()]
    // Use '9999' which can never match a real HHMM — deterministic 'closed'.
    const result = buildHeroBadge({
      category: 'hospital',
      details: { [`trmt${day}Start`]: '9999', [`trmt${day}End`]: '9999' },
    } as any)
    expect(result).toBe('closed')
  })

  it('returns openNow for library with operationStatus = 운영', () => {
    // wifi itself is gated. But other categories that aren't gated and have
    // operationStatus='운영' should propagate. Library is supported and verifies
    // the delegation path.
    expect(buildHeroBadge({
      category: 'library',
      details: { operationStatus: '운영' },
    } as any)).toBe('openNow')
  })
})
