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

const building: BuildingInfo = {
  bjdCode: '1168010100', buildingName: '테스트아파트', city: '서울', district: '강남구',
  dongName: '역삼동', roadName: null, jibun: null, buildYear: null,
  minArea: null, maxArea: null, latestDealAmount: null, latestMonthlyRent: null,
  latestDealYear: null, latestDealMonth: null, lat: null, lng: null,
}

type DetailPayload = Omit<RealEstateDetailData, 'buildingInfo'> & {
  buildingInfo?: BuildingInfo | null
  infoFetchFailed?: boolean
}
let payload: DetailPayload | null | undefined
let fetchError: Error | null
let wrapper: VueWrapper | undefined
const setupError = vi.fn()
const readAsyncData = vi.fn(async (key: string) => ({
  data: ref(key.startsWith('re-detail-new-') ? payload : null),
  error: ref(fetchError),
  status: ref(fetchError ? 'error' : 'success'),
}))

beforeEach(() => {
  setupError.mockClear()
  readAsyncData.mockClear()
  fetchError = null
  payload = {
    bjdCode: '', buildingInfo: null, infoFetchFailed: false,
    statsResponse: { monthly: [], summary: null },
    transactions: { items: [], total: 0, page: 1, totalPages: 0 },
    areaGroups: [],
  }
  vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }))
  vi.stubGlobal('createError', (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options))
  // useAsyncData 경계에서 정상 반환·전체 실패·부분 실패를 구분해 실제 페이지 setup을 실행한다.
  vi.stubGlobal('useAsyncData', readAsyncData)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function mountDetail(type = 'apt-sale') {
  vi.stubGlobal('useRoute', () => ({
    params: { realEstateType: type, city: 'seoul', district: 'gangnam', buildingName: building.buildingName },
    path: `/real-estate/${type}/seoul/gangnam/${building.buildingName}`,
    query: {},
  }))
  const { default: Page } = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
  // setup의 오류 분기를 검증한다. 오류 페이지 HTML·응답 상태는 ssr-smoke.spec.ts에서 확인한다.
  const SetupOnly = { ...Page, render: () => null }
  wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(SetupOnly) }) }), {
    global: { config: { errorHandler: setupError } },
  })
  await vi.waitFor(() => expect(readAsyncData).toHaveBeenCalledWith(
    expect.stringMatching(/^re-detail-new-/), expect.any(Function),
  ))
  await flushPromises()
}

describe('부동산 건물 상세의 확정 부재 404', () => {
  it.each(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'])(
    '%s: 조회가 성공했고 건물이 없으면 404를 던진다', async (type) => {
      await mountDetail(type)
      expect(setupError.mock.calls.map(([error]) => error)).toEqual([
        expect.objectContaining({ statusCode: 404 }),
      ])
    },
  )

  it('건물이 있으면 거래 내역이 0건이어도 404로 바꾸지 않는다', async () => {
    payload!.buildingInfo = building
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })

  it('다른 지역에서 찾은 건물을 404로 바꾸지 않는다', async () => {
    payload!.buildingInfo = { ...building, city: '제주', district: '서귀포시' }
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })

  it('건물 조회나 지역 해석이 일시 실패하면 404로 바꾸지 않는다', async () => {
    payload!.infoFetchFailed = true
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })

  it('useAsyncData 오류가 있으면 빈 데이터가 남아 있어도 404로 바꾸지 않는다', async () => {
    fetchError = new Error('upstream unavailable')
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })

  it.each([null, undefined])('SSR 반환값 자체가 %s면 부재로 확정하지 않는다', async (value) => {
    payload = value
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })

  it.each(['buildingInfo', 'infoFetchFailed'] as const)('%s 필드가 누락되면 부재로 확정하지 않는다', async (field) => {
    delete payload![field]
    await mountDetail()
    expect(setupError).not.toHaveBeenCalled()
  })
})
