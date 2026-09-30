import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Subscription, SubscriptionSourceType } from '~/types/subscription'
import { useSubscriptionHub } from '~/composables/useSubscriptionHub'

const { getSubscriptionList, getUpcomingSubscriptions, markDegradedResponse } = vi.hoisted(() => ({
  getSubscriptionList: vi.fn(),
  getUpcomingSubscriptions: vi.fn(),
  markDegradedResponse: vi.fn(),
}))

vi.mock('~/composables/useSubscription', () => ({
  useSubscription: () => ({
    getSubscriptionList,
    getUpcomingSubscriptions,
  }),
}))

vi.mock('~/composables/useDegradedResponse', () => ({
  markDegradedResponse,
}))

const hubRequests = [
  { category: 'sale', status: 'ongoing', sort: 'deadline', page: 1, limit: 4 },
  { category: 'rent', rentType: '임대주택', status: 'ongoing', sort: 'deadline', page: 1, limit: 4 },
  { status: 'upcoming', sort: 'startSoon', page: 1, limit: 4 },
] as const

let useAsyncDataMock: ReturnType<typeof vi.fn>

function subscription(id: number, overrides: Partial<Subscription> = {}): Subscription {
  const sourceType = (overrides.sourceType ?? 'APT') as SubscriptionSourceType
  return {
    id,
    houseManageNo: `HM-${id}`,
    pblancNo: `PB-${id}`,
    sourceType,
    houseName: `청약 ${id}`,
    houseType: sourceType,
    houseDetailType: null,
    rentType: null,
    regionName: '서울',
    supplyLocation: '서울시',
    totalSupplyCount: 100,
    announcementDate: '2026-05-01',
    receptionStartDate: '2026-05-20',
    receptionEndDate: '2026-05-25',
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
    ...overrides,
  }
}

function list(items: Subscription[], total = items.length) {
  return Promise.resolve({
    items,
    total,
    page: 1,
    totalPages: Math.max(1, Math.ceil(total / 4)),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAsyncDataMock = vi.fn(async (key: string, handler: () => Promise<unknown>) => {
    const data = ref(await handler())
    const state = {
      data,
      pending: ref(false),
      error: ref(null),
      status: ref('success'),
      refresh: vi.fn(),
    }
    return state
  })
  vi.stubGlobal('useAsyncData', useAsyncDataMock)
})

describe('useSubscriptionHub', () => {
  it('uses one awaited SSR key and three list requests without the legacy upcoming endpoint', async () => {
    getSubscriptionList
      .mockReturnValueOnce(list([subscription(1)], 9))
      .mockReturnValueOnce(list([subscription(2, { sourceType: 'PUBLIC_RENT', rentType: '국민임대' })], 4))
      .mockReturnValueOnce(list([subscription(3, { status: 'upcoming' })], 12))

    const hub = await useSubscriptionHub()

    expect(useAsyncDataMock).toHaveBeenCalledWith(
      'subscription-hub-v2',
      expect.any(Function),
    )
    expect(getSubscriptionList.mock.calls.map(([params]) => params)).toEqual(hubRequests)
    expect(getUpcomingSubscriptions).not.toHaveBeenCalled()
    expect(hub.sale.value.total).toBe(9)
    expect(hub.publicRent.value.total).toBe(4)
    expect(hub.upcoming.value.total).toBe(12)
  })

  it('keeps successful panels when one panel fails and uses null total for the failed panel', async () => {
    getSubscriptionList
      .mockReturnValueOnce(list([subscription(11)], 7))
      .mockRejectedValueOnce(new Error('rent unavailable'))
      .mockReturnValueOnce(list([], 0))

    const hub = await useSubscriptionHub()

    expect(hub.sale.value).toMatchObject({
      items: [expect.objectContaining({ id: 11 })],
      total: 7,
      error: false,
    })
    expect(hub.publicRent.value).toEqual({
      items: [],
      total: null,
      error: true,
    })
    expect(hub.upcoming.value).toEqual({
      items: [],
      total: 0,
      error: false,
    })
    expect(hub.publicRent.value.total).not.toBe(0)
    expect(hub.pending.value).toBe(false)
    hub.refresh()
    expect(hub.refresh).toHaveBeenCalled()
  })
})
