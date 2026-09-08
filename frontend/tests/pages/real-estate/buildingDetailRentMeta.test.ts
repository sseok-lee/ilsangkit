import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'
import type { BuildingInfo } from '~/types/realEstate'
import type { RealEstateDetailData } from '~/utils/realEstateDetailData'

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
    getApartmentPriceAnalysis: vi.fn().mockResolvedValue(null),
    getNearby: vi.fn().mockResolvedValue({ apt: [], villa: [], offitel: [] }),
  }),
}))

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
let wrapper: VueWrapper | undefined
let headFactories: Array<() => Record<string, unknown>>

beforeEach(() => {
  headFactories = []
  payload = {
    bjdCode: '', buildingInfo: rentBuilding, infoFetchFailed: false,
    statsResponse: { monthly: [], summary: { totalCount: 412 } as never },
    transactions: { items: [], total: 0, page: 1, totalPages: 0 },
    areaGroups: [],
  }
  vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }))
  vi.stubGlobal('createError', (o: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(o.statusMessage), o))
  vi.stubGlobal('useAsyncData', vi.fn(async (key: string) => ({
    data: ref(key.startsWith('re-detail-new-') ? payload : null),
    error: ref(null),
    status: ref('success'),
  })))
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
async function renderedDescription(type = 'apt-rent'): Promise<string> {
  vi.stubGlobal('useRoute', () => ({
    params: { realEstateType: type, city: 'incheon', district: 'bupyeong', buildingName: '현대' },
    path: `/real-estate/${type}/incheon/bupyeong/현대`,
    query: {},
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
  it('보증금과 월세를 함께 싣는다 — 예전엔 보증금만 나가 본문과 어긋났다', async () => {
    expect(await renderedDescription()).toContain('최근 보증금 2,000만원·월세 80만원(2026년 8월)')
  })

  it('월세 0(전세)은 전세로 표기한다', async () => {
    payload.buildingInfo = { ...rentBuilding, latestDealAmount: 40000, latestMonthlyRent: 0, latestDealMonth: 9 }
    expect(await renderedDescription()).toContain('최근 전세 4억(2026년 9월)')
  })

  it('월세 null 은 전세로 단정하지 않는다', async () => {
    payload.buildingInfo = { ...rentBuilding, latestDealAmount: 40000, latestMonthlyRent: null, latestDealMonth: 9 }
    const description = await renderedDescription()
    expect(description).toContain('최근 보증금 4억(2026년 9월)')
    expect(description).not.toContain('전세 4억')
  })

  it('보증금 0·월세 양수 거래를 통째로 숨기지 않는다', async () => {
    payload.buildingInfo = { ...rentBuilding, latestDealAmount: 0, latestMonthlyRent: 80 }
    expect(await renderedDescription()).toContain('최근 보증금 없음·월세 80만원(2026년 8월)')
  })

  it('매매는 기존 표기를 유지한다', async () => {
    payload.buildingInfo = { ...rentBuilding, latestDealAmount: 285000, latestMonthlyRent: null, latestDealMonth: 3 }
    const description = await renderedDescription('apt-sale')
    expect(description).toContain('최근 28억 5,000만원(2026년 3월)')
    expect(description).not.toContain('보증금')
  })
})
