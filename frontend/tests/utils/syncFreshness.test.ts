import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDotDate, isSyncStale, withSyncDate } from '~/utils/syncFreshness'

describe('syncFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T09:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formatDotDate: ISO를 KST YYYY.MM.DD로 변환한다', () => {
    expect(formatDotDate('2026-06-19T00:00:00.000Z')).toBe('2026.06.19')
  })

  it('formatDotDate: null·무효 입력은 null을 반환한다', () => {
    expect(formatDotDate(null)).toBeNull()
    expect(formatDotDate(undefined)).toBeNull()
    expect(formatDotDate('not-a-date')).toBeNull()
  })

  it('isSyncStale: staleDays 이내면 false, 초과하면 true', () => {
    expect(isSyncStale('2026-07-09T00:00:00.000Z', 2)).toBe(false)
    expect(isSyncStale('2026-07-01T00:00:00.000Z', 2)).toBe(true)
  })

  it('isSyncStale: null·무효 입력은 항상 true (날짜 숨김)', () => {
    expect(isSyncStale(null, 62)).toBe(true)
    expect(isSyncStale(undefined, 62)).toBe(true)
    expect(isSyncStale('nope', 62)).toBe(true)
  })

  it('withSyncDate: 신선하면 라벨에 날짜를 병기한다', () => {
    expect(withSyncDate('월 1회 자동', '2026-06-19T00:00:00.000Z')).toBe('월 1회 자동 · 2026.06.19')
  })

  it('withSyncDate: stale이거나 날짜가 없으면 라벨만 반환한다', () => {
    expect(withSyncDate('월 1회 자동', '2020-01-01T00:00:00.000Z')).toBe('월 1회 자동')
    expect(withSyncDate('매일 자동', null, 3)).toBe('매일 자동')
  })
})
