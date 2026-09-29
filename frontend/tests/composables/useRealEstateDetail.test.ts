import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { defineComponent, h, nextTick, ref, Suspense } from 'vue'
import { useRealEstateDetail } from '~/composables/useRealEstateDetail'
import type { DetailPage, DetailSnapshot } from '~/types/housingRedesign'
import type { RentTransaction, SaleTransaction } from '~/types/realEstate'
import { saleOverview, saleRows, saleSnapshot } from '../fixtures/housingRedesign'

type FetchCall = { url: string; query?: Record<string, unknown> }

type RealEstateDetailTestGlobal = typeof globalThis & {
  useApiBase: Mock
  useAsyncData: Mock
  $fetch: Mock
}

const testGlobal = globalThis as RealEstateDetailTestGlobal

function cloneSnapshot(
  patch: Partial<DetailSnapshot<SaleTransaction>> = {}
): DetailSnapshot<SaleTransaction> {
  return {
    ...saleSnapshot,
    filters: { ...saleSnapshot.filters },
    options: {
      areas: [...saleSnapshot.options.areas],
      deposits: saleSnapshot.options.deposits.map((deposit) => ({ ...deposit })),
    },
    points: saleSnapshot.points.map((point) => ({ ...point })),
    table: {
      ...saleSnapshot.table,
      items: [...saleSnapshot.table.items],
    },
    ...patch,
  }
}

function rentRow(patch: Partial<RentTransaction> = {}): RentTransaction {
  return {
    id: 1,
    city: '서울특별시',
    district: '강남구',
    bjdCode: '11680',
    dongName: '역삼동',
    buildingName: '일상숲 리버파크',
    buildYear: 2018,
    floor: 3,
    exclusiveArea: 84.9,
    jibun: '123',
    roadName: null,
    lat: null,
    lng: null,
    dealYear: 2026,
    dealMonth: 9,
    dealDay: 12,
    rentType: '월세',
    deposit: 0,
    monthlyRent: 120,
    contractTerm: null,
    contractType: null,
    preDeposit: null,
    preMonthlyRent: null,
    useRenewalRight: null,
    ...patch,
  }
}

function rentSnapshot(
  patch: Partial<DetailSnapshot<RentTransaction>> = {}
): DetailSnapshot<RentTransaction> {
  const row = rentRow()
  return {
    filters: {
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
    },
    window: { from: '2026-03-21', to: '2026-09-21' },
    options: { areas: ['84.90'], deposits: [{ amount: 0, count: 1 }] },
    points: [{ id: row.id, date: '2026-09-12', amount: 120, area: '84.90', floor: 3, deposit: 0 }],
    table: { items: [row], total: 1, page: 1, totalPages: 1 },
    generatedAt: '2026-09-21T03:00:00Z',
    adjustment: null,
    ...patch,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function installAsyncDataStub() {
  testGlobal.useAsyncData = vi.fn(async (_key: unknown, handler: () => Promise<unknown>) => ({
    data: ref(await handler()),
    pending: ref(false),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(),
  }))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  testGlobal.useApiBase = vi.fn(() => 'http://api')
  installAsyncDataStub()
})

describe('useRealEstateDetail', () => {
  it('overview와 detail useAsyncData를 내부 await 전에 모두 등록한다', async () => {
    const slowOverview = deferred<{ success: true; data: typeof saleOverview }>()
    const slowDetail = deferred<{ success: true; data: DetailSnapshot<SaleTransaction> }>()
    testGlobal.useAsyncData = vi.fn((key: unknown, handler: () => Promise<unknown>) => {
      const state = {
        data: ref<unknown>(null),
        pending: ref(true),
        error: ref(null),
        status: ref('pending'),
        refresh: vi.fn(),
      }
      const promise = Promise.resolve(handler())
        .then((result) => {
          state.data.value = result
          state.status.value = 'success'
          return state
        })
        .finally(() => {
          state.pending.value = false
        })
      return Object.assign(promise, state)
    })
    testGlobal.$fetch = vi.fn((url: string) => {
      if (url.endsWith('/detail-overview')) return slowOverview.promise
      if (url.endsWith('/detail')) return slowDetail.promise
      throw new Error(`Unexpected URL: ${url}`)
    })

    const detailPromise = useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )
    await Promise.resolve()

    expect(testGlobal.useAsyncData).toHaveBeenCalledTimes(2)
    slowOverview.resolve({ success: true, data: saleOverview })
    slowDetail.resolve({ success: true, data: saleSnapshot })
    const detail = await detailPromise
    expect(detail.snapshot.value).toEqual(saleSnapshot)
  })

  it('cached SSR empty snapshot을 추가 fetch 없이 재사용한다', async () => {
    const emptySnapshot = cloneSnapshot({
      filters: { ...saleSnapshot.filters, area: null },
      options: { areas: [], deposits: [] },
      points: [],
      table: { items: [], total: 0, page: 1, totalPages: 0 },
    })
    testGlobal.useAsyncData = vi.fn((key: unknown) => {
      const data = String(key).startsWith('real-estate-detail-overview')
        ? ref(saleOverview)
        : ref(emptySnapshot)
      return {
        data,
        pending: ref(false),
        error: ref(null),
        status: ref('success'),
        refresh: vi.fn(),
      }
    })
    testGlobal.$fetch = vi.fn()

    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    expect(detail.overview.value).toEqual(saleOverview)
    expect(detail.snapshot.value).toEqual(emptySnapshot)
    expect(detail.table.value.total).toBe(0)
    expect(testGlobal.$fetch).not.toHaveBeenCalled()
  })

  it('최초 SSR 조회는 overview와 6개월 기본 snapshot을 정확한 면적으로 요청한다', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    const detail = await useRealEstateDetail(context)

    expect(detail.overview.value).toEqual(saleOverview)
    expect(detail.snapshot.value?.filters).toEqual(saleSnapshot.filters)
    expect(detail.table.value).toEqual(saleSnapshot.table)
    expect(fetchCalls).toEqual([
      {
        url: 'http://api/api/real-estate/apt-sale/detail-overview',
        query: { bjdCode: '11680', buildingName: '일상숲 리버파크' },
      },
      {
        url: 'http://api/api/real-estate/apt-sale/detail',
        query: {
          bjdCode: '11680',
          buildingName: '일상숲 리버파크',
          mode: 'sale',
          months: 6,
        },
      },
    ])
  })

  it('buildingKey를 overview/detail/page 요청과 async cache key에 포함하고 key 변경 시 다시 조회한다', async () => {
    const firstKey = 'a'.repeat(64)
    const secondKey = 'b'.repeat(64)
    const fetchCalls: FetchCall[] = []
    const asyncKeys: string[] = []
    testGlobal.useAsyncData = vi.fn(async (key: string, handler: () => Promise<unknown>) => {
      asyncKeys.push(key)
      return {
        data: ref(await handler()),
        pending: ref(false),
        error: ref(null),
        status: ref('success'),
        refresh: vi.fn(),
      }
    })
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page')) return { success: true, data: saleSnapshot.table }
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '스톤빌리지',
      buildingKey: firstKey,
    })
    const detail = await useRealEstateDetail(context)

    expect(asyncKeys).toEqual([
      `real-estate-detail-overview:apt-sale:11680:스톤빌리지:${firstKey}`,
      `real-estate-detail:apt-sale:11680:스톤빌리지:${firstKey}:sale`,
    ])
    expect(fetchCalls[0].query).toMatchObject({ buildingKey: firstKey })
    expect(fetchCalls[1].query).toMatchObject({ buildingKey: firstKey })

    const callsBeforeEquivalentContext = testGlobal.$fetch.mock.calls.length
    context.value = { ...context.value }
    await flushPromises()
    expect(testGlobal.$fetch.mock.calls).toHaveLength(callsBeforeEquivalentContext)

    context.value = { ...context.value, buildingKey: secondKey }
    await flushPromises()
    expect(fetchCalls.at(-2)?.query).toMatchObject({ buildingKey: secondKey })
    expect(fetchCalls.at(-1)?.query).toMatchObject({ buildingKey: secondKey })

    await detail.goToPage(1)
    expect(fetchCalls.at(-1)?.query).toMatchObject({ buildingKey: secondKey, page: 1 })
  })

  it('rent route query 초기 mode=wolse를 첫 detail 요청과 asyncData key에 반영한다', async () => {
    const fetchCalls: FetchCall[] = []
    const asyncKeys: string[] = []
    testGlobal.useAsyncData = vi.fn(async (key: string, handler: () => Promise<unknown>) => {
      asyncKeys.push(key)
      return {
        data: ref(await handler()),
        pending: ref(false),
        error: ref(null),
        status: ref('success'),
        refresh: vi.fn(),
      }
    })
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) return { success: true, data: rentSnapshot() }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const detail = await useRealEstateDetail(
      ref({
        type: 'apt-rent' as const,
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        initialMode: 'wolse' as const,
      })
    )

    expect(fetchCalls[1]).toMatchObject({
      url: 'http://api/api/real-estate/apt-rent/detail',
      query: expect.objectContaining({ mode: 'wolse', months: 6 }),
    })
    expect(asyncKeys).toContain('real-estate-detail:apt-rent:11680:일상숲 리버파크:wolse')
    expect(detail.snapshot.value?.filters.mode).toBe('wolse')
  })

  it('invalid or incompatible initial modes fall back to the route type default', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail') && url.includes('/apt-sale/')) return { success: true, data: saleSnapshot }
      if (url.endsWith('/detail')) {
        return {
          success: true,
          data: rentSnapshot({
            filters: {
              bjdCode: '11680',
              buildingName: '일상숲 리버파크',
              mode: 'jeonse',
              months: 6,
              area: '84.90',
              deposit: null,
            },
          }),
        }
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    await useRealEstateDetail(
      ref({
        type: 'apt-sale' as const,
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        initialMode: 'wolse' as const,
      })
    )
    await useRealEstateDetail(
      ref({
        type: 'apt-rent' as const,
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        initialMode: 'sale' as const,
      })
    )
    await useRealEstateDetail(
      ref({
        type: 'apt-rent' as const,
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        initialMode: 'bogus' as never,
      })
    )

    const detailCalls = fetchCalls.filter((call) => call.url.endsWith('/detail'))
    expect(detailCalls[0].query).toMatchObject({ mode: 'sale' })
    expect(detailCalls[1].query).toMatchObject({ mode: 'jeonse' })
    expect(detailCalls[2].query).toMatchObject({ mode: 'jeonse' })
  })

  it('표 페이지 변경은 상단 요약·차트를 다시 읽지 않는다', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page'))
        return {
          success: true,
          data: {
            items: saleRows.slice(20),
            total: 21,
            page: 2,
            totalPages: 2,
          },
        }
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    testGlobal.$fetch = fetchMock
    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    const detail = await useRealEstateDetail(context)
    const pointsBefore = detail.snapshot.value?.points

    await detail.goToPage(2)

    expect(detail.snapshot.value?.points).toBe(pointsBefore)
    expect(detail.table.value.page).toBe(2)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('/detail-overview'))
    ).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/detail'))).toHaveLength(1)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/detail-page'))
    ).toHaveLength(1)
  })

  it('필터 변경은 단일 snapshot 요청으로 page를 1로 돌리고 적용 filters와 points를 교체한다', async () => {
    const nextSnapshot = cloneSnapshot({
      filters: { ...saleSnapshot.filters, months: 12, area: '59.90' },
      points: saleSnapshot.points.slice(0, 2),
      table: { items: saleRows.slice(0, 2), total: 2, page: 1, totalPages: 1 },
    })
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail'))
        return { success: true, data: fetchCalls.length === 2 ? saleSnapshot : nextSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    const detail = await useRealEstateDetail(context)

    await detail.setFilters({ months: 12, area: '59.90' })

    expect(detail.snapshot.value?.filters).toEqual(nextSnapshot.filters)
    expect(detail.snapshot.value?.points).toEqual(nextSnapshot.points)
    expect(detail.table.value).toEqual(nextSnapshot.table)
    expect(fetchCalls.filter((call) => call.url.endsWith('/detail'))).toHaveLength(2)
    expect(fetchCalls[2]).toMatchObject({
      url: 'http://api/api/real-estate/apt-sale/detail',
      query: {
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        mode: 'sale',
        months: 12,
        area: '59.90',
      },
    })
  })

  it('월세 0보증금은 생략하지 않고 detail과 detail-page query에 포함한다', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page'))
        return {
          success: true,
          data: {
            items: [rentRow({ id: 2, deposit: 0 })],
            total: 1,
            page: 1,
            totalPages: 1,
          } satisfies DetailPage<RentTransaction>,
        }
      if (url.endsWith('/detail'))
        return {
          success: true,
          data:
            fetchCalls.length === 2
              ? rentSnapshot({
                  filters: {
                    bjdCode: '11680',
                    buildingName: '일상숲 리버파크',
                    mode: 'jeonse',
                    months: 6,
                    area: null,
                    deposit: null,
                  },
                  options: { areas: ['84.90'], deposits: [] },
                  points: [],
                  table: { items: [], total: 0, page: 1, totalPages: 0 },
                })
              : rentSnapshot(),
        }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const context = ref({
      type: 'apt-rent' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    const detail = await useRealEstateDetail(context)

    await detail.setFilters({ mode: 'wolse', area: '84.90', deposit: 0 })
    await detail.goToPage(1)

    expect(fetchCalls[2].query).toMatchObject({ mode: 'wolse', area: '84.90', deposit: 0 })
    expect(fetchCalls[3].query).toMatchObject({ mode: 'wolse', area: '84.90', deposit: 0, page: 1 })
  })

  it('월세에서 전세로 바꾸면 보증금을 제거하고 초기화 문구를 남긴다', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail'))
        return {
          success: true,
          data:
            fetchCalls.length === 2
              ? rentSnapshot()
              : rentSnapshot({
                  filters: {
                    bjdCode: '11680',
                    buildingName: '일상숲 리버파크',
                    mode: 'jeonse',
                    months: 6,
                    area: '84.90',
                    deposit: null,
                  },
                  options: { areas: ['84.90'], deposits: [] },
                  points: [],
                  table: { items: [], total: 0, page: 1, totalPages: 0 },
                }),
        }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-rent' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    await detail.setFilters({ mode: 'jeonse' })

    expect(fetchCalls[2].query).toEqual({
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
      mode: 'jeonse',
      months: 6,
      area: '84.90',
    })
    expect(detail.announcement.value).toBe('거래 유형 변경으로 보증금 선택을 초기화했습니다')
  })

  it('면적 없거나 월세 보증금 없으면 detail-page를 호출하지 않는다', async () => {
    const noArea = cloneSnapshot({
      filters: { ...saleSnapshot.filters, area: null },
      options: { areas: [], deposits: [] },
      points: [],
      table: { items: [], total: 0, page: 1, totalPages: 0 },
    })
    const noDeposit = rentSnapshot({
      filters: {
        bjdCode: '11680',
        buildingName: '일상숲 리버파크',
        mode: 'wolse',
        months: 6,
        area: '84.90',
        deposit: null,
      },
      options: { areas: ['84.90'], deposits: [] },
      points: [],
      table: { items: [], total: 0, page: 1, totalPages: 0 },
    })
    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) return { success: true, data: noArea }
      if (url.endsWith('/detail-page')) throw new Error('detail-page should not be called')
      throw new Error(`Unexpected URL: ${url}`)
    })
    const saleDetail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )
    await saleDetail.goToPage(2)
    expect(saleDetail.table.value).toEqual(noArea.table)

    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) return { success: true, data: noDeposit }
      if (url.endsWith('/detail-page')) throw new Error('detail-page should not be called')
      throw new Error(`Unexpected URL: ${url}`)
    })
    const rentDetail = await useRealEstateDetail(
      ref({ type: 'apt-rent' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )
    await rentDetail.goToPage(2)

    expect(rentDetail.table.value).toEqual(noDeposit.table)
  })

  it('늦게 도착한 filter 응답은 최신 snapshot을 덮어쓰지 않는다', async () => {
    const slow = deferred<{ success: true; data: DetailSnapshot<SaleTransaction> }>()
    const fast = deferred<{ success: true; data: DetailSnapshot<SaleTransaction> }>()
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail') && opts?.query?.months === 12) return slow.promise
      if (url.endsWith('/detail') && opts?.query?.months === 36) return fast.promise
      if (url.endsWith('/detail')) return Promise.resolve({ success: true, data: saleSnapshot })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    const slowRequest = detail.setFilters({ months: 12 })
    const fastRequest = detail.setFilters({ months: 36 })
    fast.resolve({
      success: true,
      data: cloneSnapshot({ filters: { ...saleSnapshot.filters, months: 36 } }),
    })
    await fastRequest
    slow.resolve({
      success: true,
      data: cloneSnapshot({ filters: { ...saleSnapshot.filters, months: 12 } }),
    })
    await slowRequest

    expect(detail.snapshot.value?.filters.months).toBe(36)
    expect(detail.error.value).toBeNull()
  })

  it('늦게 도착한 page 응답은 최신 표를 덮어쓰지 않는다', async () => {
    const slow = deferred<{ success: true; data: DetailPage<SaleTransaction> }>()
    const fast = deferred<{ success: true; data: DetailPage<SaleTransaction> }>()
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail-page') && opts?.query?.page === 2) return slow.promise
      if (url.endsWith('/detail-page') && opts?.query?.page === 1) return fast.promise
      if (url.endsWith('/detail')) return Promise.resolve({ success: true, data: saleSnapshot })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    const slowPage = detail.goToPage(2)
    const fastPage = detail.goToPage(1)
    fast.resolve({
      success: true,
      data: { items: saleRows.slice(0, 20), total: 21, page: 1, totalPages: 2 },
    })
    await fastPage
    slow.resolve({
      success: true,
      data: { items: saleRows.slice(20), total: 21, page: 2, totalPages: 2 },
    })
    await slowPage

    expect(detail.table.value.page).toBe(1)
    expect(detail.tableError.value).toBeNull()
  })

  it('필터 변경이 진행 중인 page 요청을 폐기하면 tablePending을 해제한다', async () => {
    const slowPage = deferred<{ success: true; data: DetailPage<SaleTransaction> }>()
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail-page') && opts?.query?.page === 2) return slowPage.promise
      if (url.endsWith('/detail'))
        return Promise.resolve({
          success: true,
          data:
            opts?.query?.months === 12
              ? cloneSnapshot({ filters: { ...saleSnapshot.filters, months: 12 } })
              : saleSnapshot,
        })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    const pageRequest = detail.goToPage(2)
    expect(detail.tablePending.value).toBe(true)
    await detail.setFilters({ months: 12 })
    slowPage.resolve({
      success: true,
      data: { items: saleRows.slice(20), total: 21, page: 2, totalPages: 2 },
    })
    await pageRequest

    expect(detail.tablePending.value).toBe(false)
    expect(detail.table.value.page).toBe(1)
  })

  it('실패한 filter 요청은 이전 page2 표를 page1처럼 보이게 바꾸지 않는다', async () => {
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page'))
        return {
          success: true,
          data: {
            items: saleRows.slice(20),
            total: 21,
            page: 2,
            totalPages: 2,
          },
        }
      if (url.endsWith('/detail') && opts?.query?.months === 12) throw new Error('filter down')
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )
    await detail.goToPage(2)

    await detail.setFilters({ months: 12 })

    expect(detail.table.value.page).toBe(2)
    expect(detail.table.value.items).toEqual(saleRows.slice(20))
    expect(detail.error.value).toBeInstanceOf(Error)
  })

  it('동시 filter patch는 요청 상태에 병합되고 refresh는 마지막 요청 상태를 재시도한다', async () => {
    const slowMonths = deferred<{ success: true; data: DetailSnapshot<SaleTransaction> }>()
    const areaFailure = new Error('area down')
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail') && opts?.query?.months === 12 && opts?.query?.area === '59.90') {
        if (
          fetchCalls.filter((call) => call.url.endsWith('/detail') && call.query?.area === '59.90')
            .length === 1
        ) {
          return Promise.reject(areaFailure)
        }
        return Promise.resolve({
          success: true,
          data: cloneSnapshot({
            filters: { ...saleSnapshot.filters, months: 12, area: '59.90' },
          }),
        })
      }
      if (url.endsWith('/detail') && opts?.query?.months === 12) return slowMonths.promise
      if (url.endsWith('/detail')) return Promise.resolve({ success: true, data: saleSnapshot })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    const monthsRequest = detail.setFilters({ months: 12 })
    await detail.setFilters({ area: '59.90' })
    slowMonths.resolve({
      success: true,
      data: cloneSnapshot({ filters: { ...saleSnapshot.filters, months: 12 } }),
    })
    await monthsRequest
    await detail.refresh()

    const areaCalls = fetchCalls.filter(
      (call) => call.url.endsWith('/detail') && call.query?.area === '59.90'
    )
    expect(areaCalls).toHaveLength(2)
    expect(areaCalls[0].query).toMatchObject({ months: 12, area: '59.90' })
    expect(areaCalls[1].query).toMatchObject({ months: 12, area: '59.90' })
    expect(detail.snapshot.value?.filters).toMatchObject({ months: 12, area: '59.90' })
  })

  it('server adjustment 성공 후 partial patch와 refresh는 applied filters를 기준으로 요청한다', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail') && opts?.query?.area === '999.99') {
        return Promise.resolve({
          success: true,
          data: cloneSnapshot({
            filters: { ...saleSnapshot.filters, area: '84.90' },
            adjustment: 'area-reset',
          }),
        })
      }
      if (url.endsWith('/detail'))
        return Promise.resolve({
          success: true,
          data: cloneSnapshot({
            filters: {
              ...saleSnapshot.filters,
              months: Number(opts?.query?.months) as 6 | 12 | 36,
              area: String(opts?.query?.area),
            },
          }),
        })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    await detail.setFilters({ area: '999.99' })
    await detail.setFilters({ months: 12 })
    await detail.refresh()

    const detailCalls = fetchCalls.filter((call) => call.url.endsWith('/detail'))
    expect(detailCalls[2].query).toMatchObject({ months: 12, area: '84.90' })
    expect(detailCalls[3].query).toMatchObject({ months: 12, area: '84.90' })
  })

  it('page total이 snapshot total과 달라지면 snapshot을 다시 받고 갱신 문구를 남긴다', async () => {
    const refreshed = cloneSnapshot({
      table: { items: saleRows.slice(0, 20), total: 22, page: 1, totalPages: 2 },
      points: saleSnapshot.points.concat({
        id: 99,
        date: '2026-09-13',
        amount: 82000,
        area: '84.90',
        floor: 9,
        deposit: null,
      }),
    })
    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page'))
        return {
          success: true,
          data: { items: saleRows.slice(20), total: 22, page: 2, totalPages: 2 },
        }
      if (url.endsWith('/detail'))
        return {
          success: true,
          data: testGlobal.$fetch.mock.calls.length <= 2 ? saleSnapshot : refreshed,
        }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    await detail.goToPage(2)

    expect(detail.snapshot.value?.table.total).toBe(22)
    expect(detail.announcement.value).toBe('거래 정보가 갱신되었습니다')
  })

  it('page total drift refresh가 실패하면 갱신 문구를 남기지 않는다', async () => {
    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail-page'))
        return {
          success: true,
          data: { items: saleRows.slice(20), total: 22, page: 2, totalPages: 2 },
        }
      if (url.endsWith('/detail') && testGlobal.$fetch.mock.calls.length > 2)
        throw new Error('refresh down')
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    await detail.goToPage(2)

    expect(detail.snapshot.value?.table.total).toBe(21)
    expect(detail.announcement.value).toBeNull()
    expect(detail.error.value).toBeInstanceOf(Error)
  })

  it('늦은 mode-reset announcement는 최신 성공 announcement를 덮어쓰지 않는다', async () => {
    const slowJeonse = deferred<{ success: true; data: DetailSnapshot<RentTransaction> }>()
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (
        url.endsWith('/detail') &&
        opts?.query?.mode === 'jeonse' &&
        opts?.query?.area === '84.90'
      )
        return slowJeonse.promise
      if (
        url.endsWith('/detail') &&
        opts?.query?.mode === 'wolse' &&
        opts?.query?.deposit === 10000
      ) {
        return Promise.resolve({
          success: true,
          data: rentSnapshot({
            filters: {
              bjdCode: '11680',
              buildingName: '일상숲 리버파크',
              mode: 'wolse',
              months: 6,
              area: '84.90',
              deposit: 10000,
            },
            adjustment: 'deposit-reset',
          }),
        })
      }
      if (url.endsWith('/detail')) return Promise.resolve({ success: true, data: rentSnapshot() })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-rent' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    const slowReset = detail.setFilters({ mode: 'jeonse' })
    await detail.setFilters({ mode: 'wolse', deposit: 10000 })
    slowJeonse.resolve({
      success: true,
      data: rentSnapshot({
        filters: {
          bjdCode: '11680',
          buildingName: '일상숲 리버파크',
          mode: 'jeonse',
          months: 6,
          area: '84.90',
          deposit: null,
        },
      }),
    })
    await slowReset

    expect(detail.snapshot.value?.filters.mode).toBe('wolse')
    expect(detail.announcement.value).toBe('선택 가능한 보증금으로 조정되었습니다')
  })

  it('mounted async composable unmount stops context watch and late responses from mutating state', async () => {
    const slowInitial = deferred<{ success: true; data: DetailSnapshot<SaleTransaction> }>()
    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    let exposedDetail: Awaited<ReturnType<typeof useRealEstateDetail>> | null = null
    testGlobal.$fetch = vi.fn((url: string, opts?: { query?: Record<string, unknown> }) => {
      if (url.endsWith('/detail-overview'))
        return Promise.resolve({ success: true, data: saleOverview })
      if (url.endsWith('/detail') && opts?.query?.months === 6) return slowInitial.promise
      if (url.endsWith('/detail'))
        return Promise.resolve({
          success: true,
          data: cloneSnapshot({
            filters: { ...saleSnapshot.filters, months: 12 },
          }),
        })
      throw new Error(`Unexpected URL: ${url}`)
    })
    // eslint-disable-next-line vue/one-component-per-file
    const AsyncChild = defineComponent({
      async setup() {
        exposedDetail = await useRealEstateDetail(context)
        return () => h('div')
      },
    })
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(Suspense, null, {
            default: () => h(AsyncChild),
            fallback: () => h('div'),
          }),
      })
    )
    await flushPromises()

    wrapper.unmount()
    slowInitial.resolve({ success: true, data: saleSnapshot })
    await flushPromises()
    context.value = { type: 'apt-sale', bjdCode: '11680', buildingName: '일상숲 리버파크2' }
    await nextTick()
    await flushPromises()

    expect(exposedDetail?.snapshot.value).toBeNull()
    expect(
      testGlobal.$fetch.mock.calls.filter(([url]) => String(url).endsWith('/detail'))
    ).toHaveLength(1)
  })

  it('snapshot SSR 실패도 직렬화 가능한 실패 marker로 hydration에 복원한다', async () => {
    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) throw new Error('detail down')
      throw new Error(`Unexpected URL: ${url}`)
    })

    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    expect(detail.overview.value).toEqual(saleOverview)
    expect(detail.snapshot.value).toBeNull()
    expect(detail.error.value).toEqual({ ssr: true, failed: true })
    expect(detail.table.value.items).toEqual([])
  })

  it('overview 실패는 snapshot을 비우지 않고 refreshOverview로 독립 재시도한다', async () => {
    testGlobal.$fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/detail-overview') && testGlobal.$fetch.mock.calls.length === 1)
        throw new Error('overview down')
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail')) return { success: true, data: saleSnapshot }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const detail = await useRealEstateDetail(
      ref({ type: 'apt-sale' as const, bjdCode: '11680', buildingName: '일상숲 리버파크' })
    )

    expect(detail.overview.value).toBeNull()
    expect(detail.overviewError.value).toEqual({ ssr: true, failed: true })
    expect(detail.snapshot.value).toEqual(saleSnapshot)

    await detail.refreshOverview()

    expect(detail.overview.value).toEqual(saleOverview)
    expect(detail.snapshot.value).toEqual(saleSnapshot)
    expect(
      testGlobal.$fetch.mock.calls.filter(([url]) => String(url).endsWith('/detail'))
    ).toHaveLength(1)
  })

  it('context 변경은 overview와 snapshot을 다시 읽고 route type의 기본 mode를 사용한다', async () => {
    const fetchCalls: FetchCall[] = []
    testGlobal.$fetch = vi.fn(async (url: string, opts?: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts?.query })
      if (url.endsWith('/detail-overview')) return { success: true, data: saleOverview }
      if (url.endsWith('/detail'))
        return {
          success: true,
          data: url.includes('/apt-rent/')
            ? rentSnapshot({
                filters: {
                  bjdCode: '11680',
                  buildingName: '일상숲 리버파크',
                  mode: 'jeonse',
                  months: 6,
                  area: '84.90',
                  deposit: null,
                },
              })
            : saleSnapshot,
        }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const context = ref({
      type: 'apt-sale' as const,
      bjdCode: '11680',
      buildingName: '일상숲 리버파크',
    })
    const detail = await useRealEstateDetail(context)

    context.value = { type: 'apt-rent', bjdCode: '11680', buildingName: '일상숲 리버파크' }
    await flushPromises()

    expect(detail.snapshot.value?.filters.mode).toBe('jeonse')
    expect(fetchCalls.at(-1)).toMatchObject({
      url: 'http://api/api/real-estate/apt-rent/detail',
      query: expect.objectContaining({ mode: 'jeonse', months: 6 }),
    })
  })
})
