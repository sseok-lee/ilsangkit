import { describe, expect, it, vi } from 'vitest'
import type { Subscription } from '~/types/subscription'
import { createSubscriptionListRestore } from '~/utils/subscriptionListRestore'

function subscription(id: number): Subscription {
  return {
    id,
    houseManageNo: `HM-${id}`,
    pblancNo: `PB-${id}`,
    sourceType: 'APT',
    houseName: `테스트 단지 ${id}`,
    houseType: 'APT',
    houseDetailType: '민영',
    rentType: null,
    regionName: '서울',
    supplyLocation: '서울 강남구',
    totalSupplyCount: 100,
    announcementDate: '2026-09-01',
    receptionStartDate: '2026-09-10',
    receptionEndDate: '2026-09-12',
    specialStartDate: null,
    specialEndDate: null,
    rank1AreaStartDate: null,
    rank1AreaEndDate: null,
    rank1OtherStartDate: null,
    rank1OtherEndDate: null,
    rank2AreaStartDate: null,
    rank2AreaEndDate: null,
    rank2OtherStartDate: null,
    rank2OtherEndDate: null,
    winnerDate: null,
    contractStartDate: null,
    contractEndDate: null,
    moveInMonth: null,
    constructorName: null,
    developerName: null,
    homepage: null,
    pblancUrl: null,
    inquiryTel: null,
    status: 'ongoing',
  }
}

describe('createSubscriptionListRestore', () => {
  it('invalidates snapshots across KST midnight', () => {
    const cache = createSubscriptionListRestore()
    cache.save({
      key: 'rent',
      historyId: 'h1',
      items: [],
      total: 0,
      page: 1,
      totalPages: 0,
      scrollY: 0,
      firstFetchedAt: Date.parse('2026-09-22T14:59:00Z'),
      kstDay: '2026-09-22',
    })

    expect(cache.restore('rent', 'h1', Date.parse('2026-09-22T15:00:00Z'))).toBeNull()
  })

  it('restores only the latest matching key and history id inside five minutes', () => {
    const cache = createSubscriptionListRestore()
    const snapshot = {
      key: 'sale',
      historyId: 'h1',
      items: [subscription(1)],
      total: 1,
      page: 1,
      totalPages: 1,
      scrollY: 420,
      firstFetchedAt: Date.parse('2026-09-22T03:00:00Z'),
      kstDay: '2026-09-22',
    }
    cache.save(snapshot)

    expect(cache.restore('sale', 'other', Date.parse('2026-09-22T03:00:10Z'))).toBeNull()
    expect(cache.restore('other', 'h1', Date.parse('2026-09-22T03:00:10Z'))).toBeNull()
    expect(cache.restore('sale', 'h1', Date.parse('2026-09-22T03:05:01Z'))).toBeNull()
    expect(cache.restore('sale', 'h1', Date.parse('2026-09-22T03:04:59Z'))).toEqual(snapshot)
  })

  it('rejects snapshots over 200 rows and drops mutated saved rows over the boundary', () => {
    const cache = createSubscriptionListRestore()
    const first200 = Array.from({ length: 200 }, (_, index) => subscription(index + 1))
    cache.save({
      key: 'sale',
      historyId: 'h1',
      items: first200,
      total: 201,
      page: 10,
      totalPages: 11,
      scrollY: 900,
      firstFetchedAt: Date.parse('2026-09-22T03:00:00Z'),
      kstDay: '2026-09-22',
    })

    first200.push(subscription(201))

    const restored = cache.restore('sale', 'h1', Date.parse('2026-09-22T03:01:00Z'))
    expect(restored?.items).toHaveLength(200)

    cache.save({ ...restored!, items: [...restored!.items, subscription(201)] })
    expect(cache.restore('sale', 'h1', Date.parse('2026-09-22T03:01:00Z'))).toBeNull()
  })

  it('does not retain a previous snapshot after an oversized save', () => {
    const cache = createSubscriptionListRestore()
    const fetchedAt = Date.parse('2026-09-22T03:00:00Z')
    cache.save({
      key: 'sale',
      historyId: 'h1',
      items: [subscription(1)],
      total: 1,
      page: 1,
      totalPages: 1,
      scrollY: 100,
      firstFetchedAt: fetchedAt,
      kstDay: '2026-09-22',
    })

    cache.save({
      key: 'sale',
      historyId: 'h1',
      items: Array.from({ length: 201 }, (_, index) => subscription(index + 1)),
      total: 201,
      page: 11,
      totalPages: 11,
      scrollY: 900,
      firstFetchedAt: fetchedAt,
      kstDay: '2026-09-22',
    })

    expect(cache.restore('sale', 'h1', Date.parse('2026-09-22T03:01:00Z'))).toBeNull()
  })

  it('clears the saved snapshot', () => {
    const cache = createSubscriptionListRestore()
    cache.save({
      key: 'rent',
      historyId: 'h1',
      items: [subscription(1)],
      total: 1,
      page: 1,
      totalPages: 1,
      scrollY: 0,
      firstFetchedAt: Date.parse('2026-09-22T03:00:00Z'),
      kstDay: '2026-09-22',
    })

    cache.clear()

    expect(cache.restore('rent', 'h1', Date.parse('2026-09-22T03:01:00Z'))).toBeNull()
  })

  it('uses Date.now when restore time is omitted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-09-22T03:00:30Z'))
    const cache = createSubscriptionListRestore()
    cache.save({
      key: 'sale',
      historyId: 'h1',
      items: [subscription(1)],
      total: 1,
      page: 1,
      totalPages: 1,
      scrollY: 0,
      firstFetchedAt: Date.parse('2026-09-22T03:00:00Z'),
      kstDay: '2026-09-22',
    })

    expect(cache.restore('sale', 'h1')?.items).toHaveLength(1)

    vi.useRealTimers()
  })
})
