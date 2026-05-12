import { describe, it, expect } from 'vitest'
import { buildHeroBadge, buildHeroActions, buildHeroStats } from '~/utils/facilityHeroMeta'

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

describe('buildHeroActions', () => {
  const ctx = {
    kakaoMapUrl: 'https://map.kakao.com/x',
    naverMapUrl: 'https://map.naver.com/x',
  }

  it('returns directions with menu (kakao + naver) and share by default', () => {
    const actions = buildHeroActions({ category: 'toilet', details: {} } as any, ctx)
    expect(actions.map(a => a.type)).toEqual(['directions', 'share'])
    expect(actions[0].primary).toBe(true)
    expect(actions[0].href).toBeUndefined()
    expect(actions[0].menu).toHaveLength(2)
    expect(actions[0].menu![0].href).toBe('https://map.kakao.com/x')
    expect(actions[0].menu![1].href).toBe('https://map.naver.com/x')
  })

  it('inserts phone action using details.phoneNumber when present', () => {
    const actions = buildHeroActions(
      { category: 'pharmacy', details: { phoneNumber: '02-1234-5678' } } as any,
      ctx,
    )
    expect(actions.map(a => a.type)).toEqual(['directions', 'phone', 'share'])
    expect(actions[1].href).toBe('tel:02-1234-5678')
  })

  it('falls back to details.phone for parking', () => {
    const actions = buildHeroActions(
      { category: 'parking', details: { phone: '02-9999-0000' } } as any,
      ctx,
    )
    expect(actions[1]?.type).toBe('phone')
    expect(actions[1]?.href).toBe('tel:02-9999-0000')
  })

  it('uses extras.phoneNumber for school', () => {
    const actions = buildHeroActions(
      { category: 'school', details: {}, extras: { phoneNumber: '031-111-2222' } } as any,
      ctx,
    )
    expect(actions[1]?.type).toBe('phone')
    expect(actions[1]?.href).toBe('tel:031-111-2222')
  })

  it('sanitizes phone numbers with parentheses and spaces for tel: href', () => {
    const actions = buildHeroActions(
      { category: 'toilet', details: { phoneNumber: '(02) 1234-5678' } } as any,
      ctx,
    )
    expect(actions[1]?.href).toBe('tel:021234-5678')
  })

  it('skips phone action when phone is empty/null/whitespace-only', () => {
    expect(buildHeroActions({ category: 'toilet', details: { phoneNumber: '' } } as any, ctx)
      .find(a => a.type === 'phone')).toBeUndefined()
    expect(buildHeroActions({ category: 'toilet', details: { phoneNumber: null } } as any, ctx)
      .find(a => a.type === 'phone')).toBeUndefined()
    expect(buildHeroActions({ category: 'toilet', details: { phoneNumber: '   ' } } as any, ctx)
      .find(a => a.type === 'phone')).toBeUndefined()
    expect(buildHeroActions({ category: 'toilet', details: {} } as any, ctx)
      .find(a => a.type === 'phone')).toBeUndefined()
  })

  it('share action has no href and no menu (handled by emit)', () => {
    const actions = buildHeroActions({ category: 'toilet' } as any, ctx)
    const share = actions.find(a => a.type === 'share')
    expect(share?.href).toBeUndefined()
    expect(share?.menu).toBeUndefined()
  })
})

describe('buildHeroStats', () => {
  it('caps at 3 entries', () => {
    const stats = buildHeroStats({
      category: 'school',
      details: {
        operatingHours: '09-15',
        schoolLevel: '초등',
        foundationType: '공립',
        coeducationType: '남녀공학',
      },
    } as any)
    expect(stats.length).toBeLessThanOrEqual(3)
  })

  it('omits empty values', () => {
    const stats = buildHeroStats({ category: 'aed', details: {} } as any)
    expect(stats).toEqual([])
  })

  it('produces parking stats: capacity, fee, lot type', () => {
    const stats = buildHeroStats({
      category: 'parking',
      details: { capacity: 142, feeType: '5분 400원', lotType: '공영' },
    } as any)
    const labels = stats.map(s => s.label)
    expect(labels).toContain('주차면수')
    expect(labels).toContain('요금')
  })

  it('produces pharmacy stats without phone (phone moves to CTA)', () => {
    const stats = buildHeroStats({
      category: 'pharmacy',
      details: { operatingHours: '09-22', phone: '02-1234-5678' },
    } as any)
    expect(stats.find(s => s.label === '전화')).toBeUndefined()
  })

  it('produces hospital stats: clCdNm, drTotCnt, parkQty', () => {
    const stats = buildHeroStats({
      category: 'hospital',
      details: { clCdNm: '종합병원', drTotCnt: 12, parkQty: 50 },
    } as any)
    expect(stats[0]).toEqual({ label: '종별', value: '종합병원' })
    expect(stats[1]).toEqual({ label: '의사', value: '12명' })
  })

  it('produces 24h stat for facilities marked open24h', () => {
    const stats = buildHeroStats({
      category: 'toilet',
      details: { is24Hour: true },
    } as any)
    expect(stats.find(s => s.label === '운영')).toEqual({ label: '운영', value: '24시간' })
  })

  it('produces toilet stats: 24h flag, accessibility features', () => {
    const stats = buildHeroStats({
      category: 'toilet',
      details: {
        is24Hour: true,
        hasDisabledToilet: true,
        hasDiaperChangingTable: true,
      },
    } as any)
    expect(stats.find(s => s.label === '운영')).toEqual({ label: '운영', value: '24시간' })
    expect(stats.find(s => s.label === '장애인')).toEqual({ label: '장애인', value: '가능' })
  })

  it('produces toilet CCTV stat and 상시 opening when not 24h', () => {
    const stats = buildHeroStats({
      category: 'toilet',
      details: {
        openTime: '상시',
        hasCCTV: true,
      },
    } as any)
    expect(stats.find(s => s.label === '개방')).toEqual({ label: '개방', value: '상시' })
    expect(stats.find(s => s.label === 'CCTV')).toEqual({ label: 'CCTV', value: '있음' })
  })

  it('produces wifi SSID stat', () => {
    const stats = buildHeroStats({
      category: 'wifi',
      details: { ssid: 'PublicWiFi_Free' },
    } as any)
    expect(stats.find(s => s.label === 'SSID')).toEqual({ label: 'SSID', value: 'PublicWiFi_Free' })
  })

  it('produces ev-charger composition stats', () => {
    const stats = buildHeroStats({
      category: 'ev-charger',
      details: {
        chargers: [
          { chgerType: '01' }, // fast
          { chgerType: '03' }, // fast
          { chgerType: '02' }, // slow
          { chgerType: '02' }, // slow
        ],
      },
    } as any)
    expect(stats.find(s => s.label === '충전기')).toEqual({ label: '충전기', value: '4대' })
    expect(stats.find(s => s.label === '구성')).toEqual({ label: '구성', value: '급속 2 · 완속 2' })
  })

  it('produces sports stats using ftypeNm (not faciTyNm)', () => {
    const stats = buildHeroStats({
      category: 'sports',
      details: { faciGbNm: '체육시설', ftypeNm: '구기' },
    } as any)
    expect(stats.find(s => s.label === '시설구분')).toEqual({ label: '시설구분', value: '체육시설' })
    expect(stats.find(s => s.label === '유형')).toEqual({ label: '유형', value: '구기' })
  })
})
