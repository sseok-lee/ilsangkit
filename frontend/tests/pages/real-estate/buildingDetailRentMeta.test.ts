import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'
import type { BuildingInfo } from '~/types/realEstate'
import type { RealEstateDetailData } from '~/utils/realEstateDetailData'
import type { DetailOverview, DetailSnapshot } from '~/types/housingRedesign'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setBuildingPlaceSchema: vi.fn(),
    setRealEstateListingSchema: vi.fn(),
    setDetailProvenance: vi.fn(),
  }),
}))

const realEstateMocks = vi.hoisted(() => ({
  getApartmentPriceAnalysis: vi.fn(),
  getBuildingInfo: vi.fn(),
  getComplexList: vi.fn(),
  getNearby: vi.fn(),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => realEstateMocks,
}))

function mockResolverResponse() {
  return { success: true, data: { mode: 'keyed', canonicalPath: null } }
}

// 부평 현대 라이브 표본: 보증금 2,000만원 / 월 80만원, 2026년 8월
const rentBuilding: BuildingInfo = {
  bjdCode: '2823710100', buildingName: '현대', city: '인천광역시', district: '부평구',
  dongName: null, roadName: null, jibun: null, buildYear: null,
  minArea: null, maxArea: null,
  latestDealAmount: 2000, latestMonthlyRent: 80,
  latestDealYear: 2026, latestDealMonth: 8, lat: null, lng: null,
}

type DetailPayload = Omit<RealEstateDetailData, 'buildingInfo'> & {
  buildingInfo?: BuildingInfo | null
  infoFetchFailed?: boolean
}
let payload: DetailPayload
let overviewPayload: DetailOverview
let snapshotPayload: DetailSnapshot
let wrapper: VueWrapper | undefined
let headFactories: Array<() => Record<string, unknown>>
let executeInitialSsrLoader: boolean
let asyncDataKeys: string[]

beforeEach(() => {
  headFactories = []
  asyncDataKeys = []
  executeInitialSsrLoader = false
  realEstateMocks.getApartmentPriceAnalysis.mockResolvedValue(null)
  realEstateMocks.getBuildingInfo.mockResolvedValue(rentBuilding)
  realEstateMocks.getComplexList.mockResolvedValue({ items: [{ bjdCode: rentBuilding.bjdCode }] })
  realEstateMocks.getNearby.mockResolvedValue({ apt: [], villa: [], offitel: [] })
  payload = {
    bjdCode: '', buildingInfo: rentBuilding, infoFetchFailed: false,
    statsResponse: { monthly: [], summary: { totalCount: 412 } as never },
    transactions: { items: [], total: 0, page: 1, totalPages: 0 },
    areaGroups: [],
  }
  overviewPayload = {
    identity: { bjdCode: rentBuilding.bjdCode, buildingName: rentBuilding.buildingName },
    latestSale: { id: 9001, amount: 80000, year: 2026, month: 8, day: null, area: '84.90', floor: 0 },
    buildYear: null,
    minArea: null,
    maxArea: null,
    saleCount6m: 1,
    window6m: { from: '2026-03-21', to: '2026-09-21' },
    addresses: [{ dongName: '부평동', jibun: null, roadName: null }],
    location: null,
    locationAmbiguous: false,
    generatedAt: '2026-09-21T00:00:00.000Z',
  }
  snapshotPayload = {
    filters: {
      bjdCode: rentBuilding.bjdCode,
      buildingName: rentBuilding.buildingName,
      mode: 'jeonse',
      months: 6,
      area: '84.90',
      deposit: null,
    },
    window: { from: '2026-03-21', to: '2026-09-21' },
    options: { areas: ['84.90'], deposits: [] },
    points: [{ id: 1, date: '2026-08-10', amount: 40000, area: '84.90', floor: 0, deposit: null }],
    table: { items: [], total: 412, page: 1, totalPages: 21 },
    generatedAt: '2026-09-21T00:00:00.000Z',
    adjustment: null,
  }
  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/real-estate/resolve-url')) return mockResolverResponse()
    if (url.includes('/api/real-estate/canonical-url')) return mockResolverResponse()
    if (url.includes('/api/meta/sync-status')) return { success: true, data: {} }
    throw new Error(`unexpected fetch: ${url}`)
  }))
  vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }))
  vi.stubGlobal('createError', (o: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(o.statusMessage), o))
  vi.stubGlobal('useAsyncData', vi.fn(async (key: string, handler?: () => Promise<unknown>) => {
    asyncDataKeys.push(key)
    let data: unknown = null
    if (key.startsWith('re-public-url-resolution-')) {
      data = handler ? await handler() : { mode: 'keyed', canonicalPath: null }
    } else if (key.startsWith('re-detail-new-')) {
      data = executeInitialSsrLoader && handler
        ? { ...payload, ...(await handler()) as Record<string, unknown> }
        : payload
    } else if (key.startsWith('real-estate-detail-overview')) {
      data = overviewPayload
    } else if (key.startsWith('real-estate-detail:')) {
      data = snapshotPayload
    }
    return {
      data: ref(data),
      error: ref(null),
      status: ref('success'),
    }
  }))
  vi.stubGlobal('useHead', vi.fn((input: unknown) => {
    if (typeof input === 'function') headFactories.push(input as () => Record<string, unknown>)
  }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

/** 실제 페이지 setup 을 돌리고 useHead 팩토리가 만든 description 을 되읽는다. */
async function renderedDescription(
  type = 'apt-rent',
  query: Record<string, string | undefined> = {},
): Promise<string> {
  vi.stubGlobal('useRoute', () => ({
    params: { realEstateType: type, city: 'incheon', district: 'bupyeong', buildingName: '현대' },
    path: `/real-estate/${type}/incheon/bupyeong/현대`,
    query,
  }))
  const { default: Page } = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
  const SetupOnly = { ...Page, render: () => null }
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(SetupOnly) }) }), {
    global: { config: { errorHandler: vi.fn() } },
  })
  await flushPromises()
  // 첫 동적 import 는 SSR 페이로드 반영이 늦어 summary 가 아직 비어 있을 수 있다.
  // 거래 건수가 실린 뒤 읽어야 최근 거래 절까지 확정된 description 을 본다.
  await vi.waitFor(() => expect(readDescription()).toContain('실거래 412건'))
  return readDescription()
}

function readDescription(): string {
  for (const factory of headFactories) {
    const head = factory()
    const meta = (head.meta ?? []) as Array<{ name?: string; content?: string }>
    const description = meta.find(m => m.name === 'description')?.content
    if (description) return description
  }
  return ''
}

describe('전월세 상세 meta description 의 월세', () => {
  it('rent URL에서는 독립 최신 매매를 보증금/월세로 오표기하지 않는다', async () => {
    const description = await renderedDescription()
    expect(description).toContain('최근 매매 8억(2026년 8월)')
    expect(description).not.toContain('최근 보증금 8억')
    expect(description).not.toContain('최근 전세 8억')
  })



  it.each(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'])(
    '%s 상세 fixture가 route type을 받아 description을 만든다',
    async (type) => {
      const description = await renderedDescription(type)
      expect(description).toContain('현대')
      expect(description).toContain('실거래 412건')
    },
  )

  it('rent URL의 독립 최신 매매는 4억 전세 스냅샷 금액으로 대체되지 않는다', async () => {
    const description = await renderedDescription('apt-rent')
    expect(description).toContain('최근 매매 8억(2026년 8월)')
    expect(description).not.toContain('최근 매매 4억')
  })

  it('rent SSR 초기 nearby 요청은 snapshot 초기화 전에도 기본 전세 모드로 실행된다', async () => {
    executeInitialSsrLoader = true
    await renderedDescription('apt-rent')

    expect(realEstateMocks.getNearby).toHaveBeenCalledWith(
      rentBuilding.bjdCode,
      'rent',
      expect.objectContaining({ rentType: 'jeonse' }),
    )
  })

  it('route query mode=wolse는 detail hydration key로 전달된다', async () => {
    snapshotPayload = {
      ...snapshotPayload,
      filters: { ...snapshotPayload.filters, mode: 'wolse', deposit: 2000 },
    }

    await renderedDescription('apt-rent', { mode: 'wolse' })

    expect(asyncDataKeys).toContain('real-estate-detail:apt-rent:2823710100:현대:wolse')
  })

  it('sale 없는 rent-only 사례는 금액 메타를 만들지 않는다', async () => {
    overviewPayload.latestSale = null
    const description = await renderedDescription()
    expect(description).not.toContain('최근 매매')
    expect(description).not.toContain('최근 보증금')
    expect(description).not.toContain('최근 전세')
  })

  it('매매는 기존 표기를 유지한다', async () => {
    overviewPayload.latestSale = { id: 9002, amount: 285000, year: 2026, month: 3, day: null, area: '84.90', floor: 10 }
    const description = await renderedDescription('apt-sale')
    expect(description).toContain('최근 28억 5,000만원(2026년 3월)')
    expect(description).not.toContain('보증금')
  })
})
