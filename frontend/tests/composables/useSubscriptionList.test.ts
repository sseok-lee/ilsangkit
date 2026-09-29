import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import type { Subscription } from '~/types/subscription'
import type { SubscriptionListResponse } from '~/composables/useSubscription'

const mockState = vi.hoisted(() => ({
  getSubscriptionList: vi.fn(),
  loadRegions: vi.fn(),
  markDegradedResponse: vi.fn(),
  restore: null as null | {
    save: ReturnType<typeof vi.fn>
    restore: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  },
}))

vi.mock('~/composables/useSubscription', () => ({
  useSubscription: () => ({
    getSubscriptionList: mockState.getSubscriptionList,
  }),
}))

vi.mock('~/composables/useRegions', async () => {
  const vue = await import('vue')
  return {
    useRegions: () => ({
      loadRegions: mockState.loadRegions,
      isLoaded: vue.ref(false),
      error: vue.ref(null),
      citiesWithDistricts: vue.computed(() => [
        {
          slug: 'seoul',
          name: '서울',
          districts: [
            { slug: 'gangnam-gu', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
          ],
        },
      ]),
    }),
  }
})

vi.mock('~/composables/useDegradedResponse', () => ({
  markDegradedResponse: mockState.markDegradedResponse,
}))

vi.mock('~/utils/subscriptionListRestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/utils/subscriptionListRestore')>()
  return {
    ...actual,
    useSubscriptionListRestore: () => mockState.restore,
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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

function response(items: Subscription[], page: number, total = items.length, totalPages = page): SubscriptionListResponse {
  return { items, page, total, totalPages }
}

describe('useSubscriptionList', () => {
  let routeQuery: Ref<Record<string, string>>
  let replace: ReturnType<typeof vi.fn>
  let push: ReturnType<typeof vi.fn>
  let clearNuxtData: ReturnType<typeof vi.fn>
  let scrollIntoView: ReturnType<typeof vi.fn>
  let scrollTo: ReturnType<typeof vi.fn>
  let requestAnimationFrame: ReturnType<typeof vi.fn>
  let cancelAnimationFrame: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useRealTimers()
    mockState.getSubscriptionList.mockReset()
    mockState.loadRegions.mockReset()
    mockState.markDegradedResponse.mockReset()
    mockState.restore = null
    scrollIntoView = vi.fn()
    scrollTo = vi.fn()
    requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    cancelAnimationFrame = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '#subscription-results') {
        return { scrollIntoView } as unknown as Element
      }
      return null
    })
    routeQuery = ref({})
    replace = vi.fn(async ({ query }) => {
      routeQuery.value = { ...query }
    })
    push = vi.fn(async ({ query }) => {
      routeQuery.value = { ...query }
    })
    clearNuxtData = vi.fn()

    vi.stubGlobal('useRoute', () => ({
      fullPath: '/subscription/sale',
      path: '/subscription/sale',
      get query() {
        return routeQuery.value
      },
    }))
    vi.stubGlobal('useRouter', () => ({ push, replace }))
    vi.stubGlobal('useNuxtApp', () => ({ runWithContext: (fn: () => unknown) => fn() }))
    vi.stubGlobal('clearNuxtData', clearNuxtData)
    vi.stubGlobal('useAsyncData', async (_key: string, handler: () => Promise<SubscriptionListResponse | null>) => {
      const result = await handler()
      return {
        data: { value: result },
        error: { value: null },
        pending: { value: false },
        refresh: vi.fn(),
      }
    })
    mockState.loadRegions.mockResolvedValue([
      { id: 1, city: '서울', district: '강남구', slug: 'gangnam-gu', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
    ])
    mockState.getSubscriptionList.mockResolvedValue(response([subscription(1)], 1, 1, 1))
  })

  it('normalizes direct URLs with replace before first fetch without adding history or duplicate requests', async () => {
    routeQuery.value = { status: 'bad', sort: 'priority' }
    mockState.getSubscriptionList.mockResolvedValueOnce(response([subscription(1)], 1, 1, 1))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    expect(replace).toHaveBeenCalledWith({ query: {} })
    expect(push).not.toHaveBeenCalled()
    expect(mockState.getSubscriptionList).toHaveBeenCalledTimes(1)
    expect(mockState.getSubscriptionList).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, sort: 'priority', page: 1 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(routeQuery.value).toEqual({})
    expect(list.items.value.map(item => item.id)).toEqual([1])
  })

  it('does not normalize oversized keyword or unverified regional query on dictionary failure', async () => {
    routeQuery.value = { q: '가'.repeat(101), city: '서울', district: '강남구', sort: 'priority' }
    mockState.loadRegions.mockResolvedValueOnce([])

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(mockState.getSubscriptionList).not.toHaveBeenCalled()
    expect(routeQuery.value).toEqual({ q: '가'.repeat(101), city: '서울', district: '강남구', sort: 'priority' })
    expect(list.keywordError.value).toBe('검색어는 100자 이하로 입력해 주세요.')
    expect(list.regionError.value).toBe('지역 정보를 불러오지 못했습니다.')
  })

  it('does not scroll ordinary client first loads just because a cache singleton exists', async () => {
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    await useSubscriptionList({ category: 'sale' })

    expect(mockState.restore.restore).not.toHaveBeenCalled()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not scroll ordinary filter loads when no detail-return marker exists', async () => {
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.applyFilters({ q: '한강' })

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls to subscription results after marked detail-return restore miss succeeds', async () => {
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }
    history.replaceState({ existing: 'keep', ilsangkitSubscriptionReturn: true }, '')

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    await useSubscriptionList({ category: 'sale' })

    expect(history.state.existing).toBe('keep')
    expect(history.state.ilsangkitSubscriptionReturn).toBeUndefined()
    expect(mockState.restore.restore).toHaveBeenCalled()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('saves filtered detail-return snapshots against the current pushed history entry', async () => {
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }
    history.replaceState({ ilsangkitSubscriptionEntry: 'initial-entry' }, '')
    push.mockImplementationOnce(async ({ query }) => {
      routeQuery.value = { ...query }
      history.pushState({ ilsangkitSubscriptionEntry: 'filtered-entry' }, '', '/subscription/sale?q=한강')
    })
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 40, 2))
      .mockResolvedValueOnce(response([subscription(2)], 1, 40, 2))
      .mockResolvedValueOnce(response([subscription(3)], 2, 40, 2))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.applyFilters({ q: '한강' })
    await list.loadMore()
    list.saveForDetail()

    expect(mockState.restore.save).toHaveBeenCalledWith(expect.objectContaining({
      key: 'sale::::한강:::all:priority',
      historyId: 'filtered-entry',
      page: 2,
      total: 40,
    }))
  })

  it('uses the detail-return restore attempt only once before later filter changes', async () => {
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }
    history.replaceState({ ilsangkitSubscriptionReturn: true }, '')
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 1, 1))
      .mockResolvedValueOnce(response([subscription(2)], 1, 1, 1))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    await list.applyFilters({ q: '새 조건' })

    expect(mockState.restore.restore).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('fetches fresh data after leaving a list with a retained handler (detail return: %s)', async (detailReturn) => {
    const nuxtApp = { isHydrating: true, runWithContext: (fn: () => unknown) => fn() }
    vi.stubGlobal('useNuxtApp', () => nuxtApp)
    const retainedHandlers = new Map<string, () => Promise<SubscriptionListResponse | null>>()
    vi.stubGlobal('useAsyncData', vi.fn(async (key: string, handler: () => Promise<SubscriptionListResponse | null>) => {
      if (!retainedHandlers.has(key)) {
        retainedHandlers.set(key, handler)
      }
      const result = await retainedHandlers.get(key)!()
      return {
        data: { value: result },
        error: { value: null },
        pending: { value: false },
        refresh: vi.fn(),
      }
    }))
    mockState.restore = {
      save: vi.fn(),
      restore: vi.fn(() => null),
      clear: vi.fn(),
    }
    mockState.getSubscriptionList.mockImplementation((_params, options) => {
      if (options.signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      const id = mockState.getSubscriptionList.mock.calls.length
      return Promise.resolve(response([subscription(id)], 1, 1, 1))
    })

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const scope = effectScope()
    const firstList = await scope.run(() => useSubscriptionList({ category: 'sale' }))!
    expect(firstList.items.value.map(item => item.id)).toEqual([1])

    scope.stop()
    nuxtApp.isHydrating = false
    history.replaceState({ ilsangkitSubscriptionReturn: detailReturn }, '')

    const restoredList = await useSubscriptionList({ category: 'sale' })

    expect(restoredList.items.value.map(item => item.id)).toEqual([2])
    expect(mockState.getSubscriptionList).toHaveBeenCalledTimes(2)
    if (detailReturn) {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    } else {
      expect(scrollIntoView).not.toHaveBeenCalled()
    }
  })

  it('awaits regions before SSR list fetch and blocks regional queries when the dictionary fails', async () => {
    routeQuery.value = { city: '서울', district: '강남구' }
    mockState.loadRegions.mockResolvedValueOnce([])

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    expect(list.regionError.value).toBe('지역 정보를 불러오지 못했습니다.')
    expect(mockState.getSubscriptionList).not.toHaveBeenCalled()
    expect(mockState.markDegradedResponse).toHaveBeenCalledTimes(1)
  })

  it('allows nationwide list fetch when regions fail', async () => {
    mockState.loadRegions.mockResolvedValueOnce([])

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'rent' })

    expect(list.regionError.value).toBeNull()
    expect(list.items.value).toEqual([subscription(1)])
    expect(mockState.getSubscriptionList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'rent', page: 1, limit: 20 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('keeps the latest filter response when an older request resolves later', async () => {
    const slow = deferred<SubscriptionListResponse>()
    const fast = deferred<SubscriptionListResponse>()
    mockState.getSubscriptionList.mockImplementation((params) => {
      if (params.q === '느린 요청') return slow.promise
      if (params.q === '빠른 요청') return fast.promise
      return Promise.resolve(response([subscription(1)], 1, 1, 1))
    })

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    const firstApply = list.applyFilters({ q: '느린 요청' })
    const secondApply = list.applyFilters({ q: '빠른 요청' })
    fast.resolve(response([subscription(3)], 1, 1, 1))
    await secondApply
    slow.resolve(response([subscription(2)], 1, 1, 1))
    await firstApply

    expect(list.items.value.map(item => item.id)).toEqual([3])
    expect(list.error.value).toBeNull()
    expect(list.pending.value).toBe(false)
  })

  it('keeps page after load-more failure and retries the same page with duplicate ids merged', async () => {
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1), subscription(2)], 1, 5, 3))
      .mockRejectedValueOnce(new Error('[GET] "/api/subscription?page=2": 503 Service Unavailable'))
      .mockResolvedValueOnce(response([subscription(2), subscription(3)], 2, 5, 3))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    await list.loadMore()
    expect(list.page.value).toBe(1)
    expect(list.items.value.map(item => item.id)).toEqual([1, 2])
    expect(list.total.value).toBe(5)
    expect(list.moreError.value).toBe('청약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(list.moreError.value).not.toContain('/api/subscription')

    await list.loadMore()
    expect(mockState.getSubscriptionList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(list.items.value.map(item => item.id)).toEqual([1, 2, 3])
    expect(list.page.value).toBe(2)
    expect(list.total.value).toBe(5)
    expect(list.totalPages.value).toBe(3)
    expect(list.moreError.value).toBeNull()
  })

  it('maps first-page fetch failures to generic copy without exposing request URLs', async () => {
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 521, 27))
      .mockRejectedValueOnce(new Error('[GET] "/api/subscription?category=rent&q=%EC%88%98%EC%9B%90&page=1": 503 Service Unavailable'))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'rent', type: 'public', rentType: '임대주택' })
    await list.applyFilters({ q: '수원' })

    expect(list.error.value).toBe('청약 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(list.error.value).not.toContain('/api/subscription')
    expect(list.error.value).not.toContain('503')
    expect(mockState.markDegradedResponse).toHaveBeenCalledTimes(1)
  })

  it('does not fetch when applyFilters normalizes to the current key', async () => {
    routeQuery.value = { q: '한강' }
    mockState.getSubscriptionList.mockResolvedValueOnce(response([subscription(1)], 1, 1, 1))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.applyFilters({ q: '  한강  ' })
    await nextTick()

    expect(mockState.getSubscriptionList).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('adds history with push for applied filters and does not use replace for the selection', async () => {
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 2, 2))
      .mockResolvedValueOnce(response([subscription(2)], 1, 1, 1))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.applyFilters({ q: '한강' })
    await nextTick()
    await nextTick()

    expect(push).toHaveBeenCalledWith({ query: { q: '한강' } })
    expect(replace).not.toHaveBeenCalled()
    expect(list.items.value.map(item => item.id)).toEqual([2])
  })

  it('applies cached useAsyncData payload during hydration without calling the handler', async () => {
    vi.stubGlobal('useNuxtApp', () => ({ isHydrating: true, runWithContext: (fn: () => unknown) => fn() }))
    vi.stubGlobal('useAsyncData', vi.fn(async () => ({
      data: { value: response([subscription(9)], 1, 1, 1) },
      error: { value: null },
      pending: { value: false },
      refresh: vi.fn(),
    })))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    expect(mockState.getSubscriptionList).not.toHaveBeenCalled()
    expect(list.items.value.map(item => item.id)).toEqual([9])
    expect(list.total.value).toBe(1)
    expect(list.page.value).toBe(1)
  })

  it('retries a regional dictionary failure without widening the regional URL to nationwide data', async () => {
    routeQuery.value = { city: '서울', district: '강남구' }
    mockState.loadRegions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 1, city: '서울', district: '강남구', slug: 'gangnam-gu', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
      ])

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.retry()

    expect(mockState.getSubscriptionList).not.toHaveBeenCalled()
    expect(list.regionError.value).toBe('지역 정보를 불러오지 못했습니다.')
    expect(routeQuery.value).toEqual({ city: '서울', district: '강남구' })

    await list.retry()

    expect(list.regionError.value).toBeNull()
    expect(mockState.getSubscriptionList).toHaveBeenCalledWith(
      expect.objectContaining({ region: '서울 강남구', page: 1, limit: 20 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('preserves a regional URL when applyFilters runs during dictionary failure', async () => {
    routeQuery.value = { city: '서울', district: '강남구' }
    mockState.loadRegions.mockResolvedValueOnce([])

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })
    await list.applyFilters({ q: '한강' })

    expect(mockState.getSubscriptionList).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(routeQuery.value).toEqual({ city: '서울', district: '강남구' })
    expect(list.regionError.value).toBe('지역 정보를 불러오지 못했습니다.')
  })

  it('clears superseded append pending state so future load-more can run', async () => {
    const append = deferred<SubscriptionListResponse>()
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 5, 3))
      .mockReturnValueOnce(append.promise)
      .mockResolvedValueOnce(response([subscription(4)], 1, 2, 2))
      .mockResolvedValueOnce(response([subscription(4), subscription(5)], 2, 2, 2))

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList({ category: 'sale' })

    const loadMore = list.loadMore()
    await list.applyFilters({ q: '새 조건' })
    append.resolve(response([subscription(2)], 2, 5, 3))
    await loadMore

    expect(list.pendingMore.value).toBe(false)
    await list.loadMore()
    expect(mockState.getSubscriptionList).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '새 조건', page: 2 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('reloads when a reactive scope subtype changes with the same query', async () => {
    mockState.getSubscriptionList
      .mockResolvedValueOnce(response([subscription(1)], 1, 1, 1))
      .mockResolvedValueOnce(response([subscription(8)], 1, 1, 1))
    const scope = ref({ category: 'sale' as const, type: 'apt', sourceType: 'APT' as const })

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const list = await useSubscriptionList(scope)
    scope.value = { category: 'sale', type: 'offitel', sourceType: 'OFFITEL' }
    await nextTick()
    await nextTick()

    expect(mockState.getSubscriptionList).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceType: 'OFFITEL', page: 1 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    await vi.waitFor(() => {
      expect(list.items.value.map(item => item.id)).toEqual([8])
    })
  })

  it('aborts in-flight requests when the consuming scope disposes', async () => {
    const slow = deferred<SubscriptionListResponse>()
    let capturedSignal: AbortSignal | undefined

    mockState.getSubscriptionList.mockImplementationOnce((_params, options) => {
      capturedSignal = options.signal
      return slow.promise
    })

    const { useSubscriptionList } = await import('~/composables/useSubscriptionList')
    const scope = effectScope()
    const started = scope.run(() => useSubscriptionList({ category: 'sale' }))!
    await vi.waitFor(() => {
      expect(capturedSignal).toBeDefined()
    })

    scope.stop()

    expect(capturedSignal?.aborted).toBe(true)
    slow.resolve(response([subscription(1)], 1, 1, 1))
    await started
  })
})
