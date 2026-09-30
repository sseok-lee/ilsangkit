import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, Suspense } from 'vue'
import type { Ref } from 'vue'
import type { BuildingInfo } from '~/types/realEstate'
import type { DetailOverview, DetailSnapshot } from '~/types/housingRedesign'

const mockState = vi.hoisted(() => ({
  detail: null as null | {
    overview: Ref<DetailOverview | null>
    snapshot: Ref<DetailSnapshot | null>
    table: Ref<DetailSnapshot['table']>
    pending: Ref<boolean>
    tablePending: Ref<boolean>
    error: Ref<unknown>
    overviewError: Ref<unknown>
    tableError: Ref<unknown>
    announcement: Ref<string | null>
    setFilters: ReturnType<typeof vi.fn>
    goToPage: ReturnType<typeof vi.fn>
    refresh: ReturnType<typeof vi.fn>
    refreshOverview: ReturnType<typeof vi.fn>
  },
}))

vi.mock('~/composables/useRealEstateDetail', () => ({
  useRealEstateDetail: vi.fn(async () => mockState.detail),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setBuildingPlaceSchema: vi.fn(),
    setRealEstateListingSchema: vi.fn(),
    setDetailProvenance: vi.fn(),
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getBuildingInfo: vi.fn(),
    getComplexList: vi.fn(),
    getNearby: vi.fn().mockResolvedValue({ apt: [], villa: [], offitel: [] }),
  }),
}))

function mockResolverResponse() {
  return { success: true, data: { mode: 'keyed', canonicalPath: null } }
}

const building: BuildingInfo = {
  bjdCode: '1165010700',
  buildingName: '반포자이',
  city: '서울특별시',
  district: '서초구',
  dongName: '반포동',
  roadName: null,
  jibun: '20',
  buildYear: 2009,
  minArea: 84.9,
  maxArea: 84.9,
  latestDealAmount: null,
  latestMonthlyRent: null,
  latestDealYear: null,
  latestDealMonth: null,
  lat: 37.507,
  lng: 127.011,
}

function overview(locationAmbiguous: boolean, location: DetailOverview['location']): DetailOverview {
  return {
    identity: { bjdCode: building.bjdCode, buildingName: building.buildingName },
    latestSale: { id: 1, amount: 300000, year: 2026, month: 8, day: 3, area: '84.90', floor: 12 },
    buildYear: 2009,
    minArea: '84.90',
    maxArea: '84.90',
    saleCount6m: 4,
    window6m: { from: '2026-03-21', to: '2026-09-21' },
    addresses: [{ dongName: '반포동', jibun: '20', roadName: null }],
    location,
    locationAmbiguous,
    generatedAt: '2026-09-21T00:00:00.000Z',
  }
}

const snapshot: DetailSnapshot = {
  filters: {
    bjdCode: building.bjdCode,
    buildingName: building.buildingName,
    mode: 'sale',
    months: 6,
    area: '84.90',
    deposit: null,
  },
  window: { from: '2026-03-21', to: '2026-09-21' },
  options: { areas: ['84.90'], deposits: [] },
  points: [{ id: 1, date: '2026-08-03', amount: 300000, area: '84.90', floor: 12, deposit: null }],
  table: { items: [], total: 4, page: 1, totalPages: 1 },
  generatedAt: '2026-09-21T00:00:00.000Z',
  adjustment: null,
}

let wrapper: VueWrapper | undefined
let headFactories: Array<() => Record<string, unknown>>
type PendingCounts = {
  url: string
  resolve: (value: unknown) => void
}

let resolveCounts: ((value: unknown) => void) | null
let nearbyCountsStarted: Promise<void>
let markNearbyCountsStarted: (() => void) | null
let pendingCounts: PendingCounts[]
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  headFactories = []
  resolveCounts = null
  pendingCounts = []
  markNearbyCountsStarted = null
  nearbyCountsStarted = new Promise(resolve => { markNearbyCountsStarted = resolve })

  mockState.detail = {
    overview: ref(null),
    snapshot: ref(snapshot),
    table: ref(snapshot.table),
    pending: ref(false),
    tablePending: ref(false),
    error: ref(null),
    overviewError: ref(new Error('overview down')),
    tableError: ref(null),
    announcement: ref(null),
    setFilters: vi.fn(),
    goToPage: vi.fn(),
    refresh: vi.fn(),
    refreshOverview: vi.fn(),
  }

  fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/api/real-estate/resolve-url')) return mockResolverResponse()
    if (url.includes('/api/real-estate/canonical-url')) return mockResolverResponse()
    if (url.includes('/api/facilities/nearby-counts')) {
      markNearbyCountsStarted?.()
      return await new Promise(resolve => {
        resolveCounts = resolve
        pendingCounts.push({ url, resolve })
      })
    }
    if (url.includes('/api/meta/sync-status')) return { success: true, data: {} }
    throw new Error(`unexpected fetch: ${url}`)
  })

  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRoute', () => ({
    params: { realEstateType: 'apt-sale', city: 'seoul', district: 'seocho', buildingName: '반포자이' },
    path: '/real-estate/apt-sale/seoul/seocho/반포자이',
    query: {},
  }))
  vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }))
  vi.stubGlobal('createError', (o: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(o.statusMessage), o))
  vi.stubGlobal('useHead', vi.fn((input: unknown) => {
    if (typeof input === 'function') headFactories.push(input as () => Record<string, unknown>)
  }))
  vi.stubGlobal('useAsyncData', vi.fn(async (key: string, handler?: () => Promise<unknown>) => {
    if (key.startsWith('re-public-url-resolution-')) {
      return {
        data: ref(handler ? await handler() : { mode: 'keyed', canonicalPath: null }),
        error: ref(null),
        status: ref('success'),
      }
    }
    if (key.startsWith('re-detail-new-')) {
      return {
        data: ref({
          bjdCode: building.bjdCode,
          buildingInfo: building,
          facilitySummary: null,
          nearby: { apt: [], villa: [], offitel: [] },
          nearbyLoaded: true,
          infoFetchFailed: false,
        }),
        error: ref(null),
        status: ref('success'),
      }
    }
    if (key.startsWith('re-detail-overview-facility-summary')) {
      return { data: ref(handler ? await handler() : null), error: ref(null), status: ref('success') }
    }
    return { data: ref(null), error: ref(null), status: ref('success') }
  }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function mountPage(): Promise<void> {
  const { default: Page } = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
  const SetupOnly = { ...Page, render: () => null }
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(SetupOnly) }) }), {
    global: { config: { errorHandler: vi.fn() } },
  })
  await flushPromises()
}

function description(): string {
  for (const factory of headFactories) {
    const meta = (factory().meta ?? []) as Array<{ name?: string; content?: string }>
    const value = meta.find(item => item.name === 'description')?.content
    if (value) return value
  }
  return ''
}

describe('부동산 상세 overview 좌표 기반 시설 요약 lifecycle', () => {
  it('overview 복구 후 좌표 요약을 요청하고 모호해진 위치에는 지연 응답을 적용하지 않는다', async () => {
    await mountPage()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/nearby-counts'))).toHaveLength(0)

    mockState.detail!.overviewError.value = null
    mockState.detail!.overview.value = overview(false, { lat: 37.507, lng: 127.011 })
    await nextTick()
    await nearbyCountsStarted
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/nearby-counts'))).toHaveLength(1)

    mockState.detail!.overview.value = overview(true, null)
    await nextTick()
    resolveCounts?.({
      data: {
        radius: 300,
        counts: {
          school: { count: 3, exact: true },
          hospital: { count: 2, exact: true },
        },
      },
    })
    await flushPromises()

    expect(description()).not.toContain('학교 3곳')
    expect(description()).not.toContain('병원 2곳')
  })

  it('느린 이전 위치 응답이 빠른 새 위치 요약을 지우지 않는다', async () => {
    await mountPage()

    mockState.detail!.overviewError.value = null
    mockState.detail!.overview.value = overview(false, { lat: 37.507, lng: 127.011 })
    await nextTick()
    await vi.waitFor(() => expect(pendingCounts).toHaveLength(1))

    mockState.detail!.overview.value = overview(false, { lat: 37.508, lng: 127.012 })
    await nextTick()
    await vi.waitFor(() => expect(pendingCounts).toHaveLength(2))

    pendingCounts[1].resolve({
      data: {
        radius: 300,
        counts: {
          school: { count: 5, exact: true },
          hospital: { count: 4, exact: true },
        },
      },
    })
    await flushPromises()
    expect(description()).toContain('학교 5곳')
    expect(description()).toContain('병원 4곳')

    pendingCounts[0].resolve({
      data: {
        radius: 300,
        counts: {
          school: { count: 1, exact: true },
          hospital: { count: 1, exact: true },
        },
      },
    })
    await flushPromises()

    expect(description()).toContain('학교 5곳')
    expect(description()).toContain('병원 4곳')
    expect(description()).not.toContain('학교 1곳')
  })

})
