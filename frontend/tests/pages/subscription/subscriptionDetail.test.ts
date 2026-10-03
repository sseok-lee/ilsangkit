import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, defineComponent, h, Suspense } from 'vue'
import SubscriptionDetail from '~/pages/subscription/[id].vue'

const { setMetaMock, setBreadcrumbSchemaMock, setEventSchemaMock, setDetailProvenanceMock, trackSubscriptionViewMock } = vi.hoisted(() => ({
  setMetaMock: vi.fn(),
  setBreadcrumbSchemaMock: vi.fn(),
  setEventSchemaMock: vi.fn(),
  setDetailProvenanceMock: vi.fn(),
  trackSubscriptionViewMock: vi.fn(),
}))

// Nuxt auto-import shims (ref/computed/watch are auto-imported in Nuxt but not in vitest)
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// useRoute → id
;(globalThis as any).useRoute = vi.fn(() => ({ params: { id: '123' }, query: {} }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '123' } }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// 컴포저블 목 (h1/순서 가드만 필요 — 사이드이펙트 차단)
vi.mock('~/composables/useSubscription', () => ({
  useSubscription: () => ({ getSubscriptionDetail: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: setBreadcrumbSchemaMock,
    setEventSchema: setEventSchemaMock,
    setDetailProvenance: setDetailProvenanceMock,
  }),
}))
vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackSubscriptionView: trackSubscriptionViewMock }),
}))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: setMetaMock }),
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((o: any) => Object.assign(new Error(o?.statusMessage || 'e'), o)))

const mockSubscription = {
  id: 123,
  houseName: '래미안 원베일리',
  houseType: '아파트',
  status: 'closed',
  rentType: '분양주택',
  sourceType: 'APT',
  regionName: '서울 서초구',
  supplyLocation: '서울 서초구 반포동',
  totalSupplyCount: 2990,
  moveInMonth: '202608',
  lat: 37.5,
  lng: 127.0,
  inquiryTel: '02-123-4567',
  homepage: null,
  pblancUrl: null,
  receptionStartDate: null,
  receptionEndDate: null,
  winnerDate: null,
  constructorName: null,
  developerName: null,
  houseDetailType: null,
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const mockUnitTypes = [
  { id: 1, houseType: '084.9421A', supplyArea: '112.5', generalCount: 100, specialCount: 50, topAmount: 120000 },
]

function mockUseAsyncDataWith(data: any) {
  // Page uses `await useAsyncData(key, fetcher)` — must return thenable with .data
  ;(globalThis as any).useAsyncData = vi.fn(async (_key: string, _fetcher?: any) => ({
    data: ref(data),
    status: ref('success'),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(false),
  }))
}

const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  Teleport: true,
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityRoadview: { template: '<div data-testid="roadview">Roadview</div>' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
  SubscriptionScheduleTimeline: { template: '<div data-testid="schedule">Schedule</div>', props: ['subscription'] },
  RentalPriceStatsBox: { template: '<div data-testid="rental-price-stats" />', props: ['subscriptionId', 'regionName'] },
  RelatedGuides: { template: '<div data-testid="related-guides" />', props: ['categories', 'limit'] },
  DataSourceSection: { template: '<div data-testid="data-source" />', props: ['domain', 'lastSyncDate'] },
  AdBanner: { template: '<div data-testid="ad-banner" />' },
  SectionBlock: { template: '<section><h2 v-if="heading">{{ heading }}</h2><slot name="right" /><slot /></section>', props: ['heading', 'subtext'] },
  PageHead: {
    props: ['eyebrow', 'title', 'description', 'titleTag'],
    template: '<div class="page-head-stub"><p v-if="eyebrow">{{ eyebrow }}</p><h1>{{ title }}</h1><p v-if="description">{{ description }}</p><slot /><slot name="actions" /></div>',
  },
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(SubscriptionDetail) })
      },
    }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

// flex `order-N` 이 시각 순서를 결정하므로(happy-dom 은 레이아웃 미계산),
// order 값으로 정렬해 시각 순서를 복원한 뒤 광고↔광고 인접 쌍의 개수를 센다.
// 조건부 섹션이 비어 사라져도 두 광고가 붙지 않아야 한다(= 0).
function adAdjacencyViolations(wrapper: Awaited<ReturnType<typeof mountSuspended>>): number {
  const items = wrapper.findAll('*')
    .map((el, domIdx) => {
      const m = (el.attributes('class') || '').match(/\border-(\d+)\b/)
      return m
        ? { order: Number(m[1]), isAd: el.attributes('data-testid') === 'ad-banner', domIdx }
        : null
    })
    .filter((x): x is { order: number; isAd: boolean; domIdx: number } => x !== null)
    .sort((a, b) => a.order - b.order || a.domIdx - b.domIdx)
  let violations = 0
  for (let i = 1; i < items.length; i++) {
    if (items[i].isAd && items[i - 1].isAd) violations++
  }
  return violations
}

describe('subscription/[id].vue 섹션 재배치', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAsyncDataWith({ ...mockSubscription, unitTypes: mockUnitTypes, competitions: [], scores: [], specialStatuses: [] })
  })

  it('literal h1은 정확히 1개이고 청약 단지명이다 (단일 h1 불변식)', async () => {
    const wrapper = await mountSuspended()
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('래미안 원베일리')
  })

  it('모바일 헤더가 eyebrow(분양 · 마감)를 노출한다', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.text()).toContain('분양 · 마감')
  })

  it('청약 일정과 면적별 공급정보 섹션이 모두 렌더된다', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.find('[data-testid="schedule"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('면적별 공급정보')
  })

  it('AdBanner는 정확히 4개다 (추가·삭제 금지)', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.findAll('[data-testid="ad-banner"]').length).toBe(4)
  })

  it('결과 미발표(경쟁률·가점·특별공급 empty) 상태에서 광고가 연속으로 붙지 않는다', async () => {
    // beforeEach 목: competitions/scores/specialStatuses 전부 [] → 5790류 결과 미발표 청약 재현.
    // 광고②(order-5)와 광고③(order-10) 사이에 항상 렌더되는 기본정보(order-9)가 있어야 함.
    const wrapper = await mountSuspended()
    expect(adAdjacencyViolations(wrapper)).toBe(0)
  })

  it('좌표·공급정보까지 없는 최소 데이터에서도 광고가 연속으로 붙지 않고 4개 유지', async () => {
    // 최악 케이스: 좌표 없음(위치·로드뷰 대신 fallback) + 공급정보 없음 + 결과 미발표.
    mockUseAsyncDataWith({
      ...mockSubscription, lat: null, lng: null,
      unitTypes: [], competitions: [], scores: [], specialStatuses: [],
    })
    const wrapper = await mountSuspended()
    expect(adAdjacencyViolations(wrapper)).toBe(0)
    expect(wrapper.findAll('[data-testid="ad-banner"]').length).toBe(4)
  })

  it('청약 일정과 면적별 공급정보 사이에 광고가 없다 (T1 두 표 안 끊음)', async () => {
    const wrapper = await mountSuspended()
    const html = wrapper.html()
    // order-3(일정) → order-4(공급정보) → order-5(광고②) 순으로 DOM에 등장해야 함
    const idxOrder3 = html.indexOf('order-3')
    const idxOrder4 = html.indexOf('order-4')
    const idxOrder5 = html.indexOf('order-5')
    expect(idxOrder3).toBeGreaterThan(-1)
    expect(idxOrder4).toBeGreaterThan(idxOrder3)
    expect(idxOrder5).toBeGreaterThan(idxOrder4)
  })

  it('일정(order-3) → 공급정보(order-4) → 광고②(order-5) 순서 클래스를 갖는다', async () => {
    const wrapper = await mountSuspended()
    const html = wrapper.html()
    expect(html).toMatch(/order-3/)
    expect(html).toMatch(/order-4/)
    expect(html).toMatch(/order-5/)
  })

  it('T0 헤더(order-1)와 첫 광고(order-2) 클래스가 존재한다', async () => {
    const wrapper = await mountSuspended()
    const html = wrapper.html()
    expect(html).toMatch(/order-1/)
    expect(html).toMatch(/order-2/)
  })

  it('DataSourceSection이 끝단(order-12)에 렌더된다', async () => {
    const wrapper = await mountSuspended()
    const ds = wrapper.find('[data-testid="data-source"]')
    expect(ds.exists()).toBe(true)
  })

  it('분양 상세는 분양가 헤더와 평당가를 유지한다', async () => {
    const wrapper = await mountSuspended()
    const text = wrapper.text()
    expect(text).toContain('분양가')
    expect(text).toContain('분양최고가')
    expect(text).toContain('평당가')
    expect(text).toContain('12억')
    expect(setMetaMock).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('분양가'),
    }))
  })

  it('정규화된 공공임대 상세는 가격을 지어내지 않고 임대 시세와 임대 breadcrumb를 유지한다', async () => {
    mockUseAsyncDataWith({
      ...mockSubscription,
      rentType: '임대주택',
      unitTypes: [{ ...mockUnitTypes[0], topAmount: 5000 }],
      competitions: [],
      scores: [],
      specialStatuses: [],
    })
    const wrapper = await mountSuspended()
    const text = wrapper.text()

    expect(text).toContain('임대 · 마감')
    expect(text).toContain('공공임대')
    expect(text).toContain('임대 조건')
    expect(text).toContain('원문 확인')
    expect(text).not.toContain('분양가')
    expect(text).not.toContain('분양최고가')
    expect(text).not.toContain('평당가')
    expect(text).not.toContain('5,000만원')
    expect(wrapper.find('[data-testid="rental-price-stats"]').exists()).toBe(true)
    expect(setBreadcrumbSchemaMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: '임대', url: expect.stringContaining('/subscription/rent') }),
    ]))
    expect(setMetaMock).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.not.stringContaining('분양가'),
    }))
  })

  it('공급 표에서 0세대와 미제공을 구분하고 같은 unitTypes로 모바일 요약과 전체표를 렌더한다', async () => {
    mockUseAsyncDataWith({
      ...mockSubscription,
      totalSupplyCount: 0,
      unitTypes: [
        {
          ...mockUnitTypes[0],
          generalCount: 0,
          specialCount: null,
          topAmount: null,
          newlywedsCount: 0,
          multiChildCount: 2,
        },
      ],
      competitions: [],
      scores: [],
      specialStatuses: [],
    })
    const wrapper = await mountSuspended()
    const text = wrapper.text()

    expect(text).toContain('0호')
    expect(text).toContain('0세대')
    expect(text).toContain('미제공')
    expect(wrapper.find('[aria-label="면적별 공급정보 전체 표"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="unit-summary-list"]').exists()).toBe(true)
  })



  it('다중 주택형 합계에서 전부 미제공인 공급수는 0으로 만들지 않고 일부 알려진 값은 합산한다', async () => {
    mockUseAsyncDataWith({
      ...mockSubscription,
      unitTypes: [
        {
          ...mockUnitTypes[0],
          id: 1,
          houseType: '059.0000A',
          generalCount: null,
          specialCount: null,
          topAmount: null,
        },
        {
          ...mockUnitTypes[0],
          id: 2,
          houseType: '084.0000A',
          generalCount: null,
          specialCount: 0,
          topAmount: null,
        },
      ],
      competitions: [],
      scores: [],
      specialStatuses: [],
    })
    const wrapper = await mountSuspended()
    const footer = wrapper.find('tfoot')

    expect(footer.exists()).toBe(true)
    expect(footer.text()).toContain('미제공')
    expect(footer.text()).toContain('0호')
    expect(footer.text()).not.toContain('0호0호0호')
  })

  it('다중 주택형 합계에서 일반·특별 공급이 모두 미제공이면 합계도 미제공으로 남긴다', async () => {
    mockUseAsyncDataWith({
      ...mockSubscription,
      unitTypes: [
        { ...mockUnitTypes[0], id: 1, houseType: '059.0000A', generalCount: null, specialCount: null, topAmount: null },
        { ...mockUnitTypes[0], id: 2, houseType: '084.0000A', generalCount: null, specialCount: null, topAmount: null },
      ],
      competitions: [],
      scores: [],
      specialStatuses: [],
    })
    const wrapper = await mountSuspended()
    const footerText = wrapper.find('tfoot').text()

    expect((footerText.match(/미제공/g) || []).length).toBeGreaterThanOrEqual(3)
    expect(footerText).not.toContain('0호')
  })

  it('PUBLIC_RENT 상세는 공급지역별 조건을 렌더하고 다지역 지도와 시세 연동을 막는다', async () => {
    mockUseAsyncDataWith({
      ...mockSubscription,
      sourceType: 'PUBLIC_RENT',
      status: 'unknown',
      houseName: 'LH 국민임대 전국 모집',
      houseType: '공공임대',
      rentType: '국민임대',
      regionName: '전국',
      supplyLocation: '전국',
      totalSupplyCount: null,
      developerName: '한국토지주택공사',
      pblancUrl: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do',
      lat: 37.5,
      lng: 127.0,
      publicRental: {
        provider: '한국토지주택공사',
        sources: ['MYHOME', 'LH'],
        sourceIds: { myhome: ['M-1'], lh: ['L-1'] },
        sourceStatus: null,
        lastSyncedAt: '2026-09-21T00:00:00.000Z',
        isCorrection: false,
        supplies: [
          { key: 'a', name: '강남권 국민임대', region: '서울 강남구', address: '서울 강남구 자곡동', supplyCount: 24, deposit: 12000000, monthlyRent: 180000, receptionStartDate: '2026-10-01', receptionEndDate: '2026-10-08' },
          { key: 'b', name: '수원 매입임대', region: '경기 수원시', address: null, supplyCount: null, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
        ],
      },
      unitTypes: [],
      competitions: [],
      scores: [],
      specialStatuses: [],
    })

    const wrapper = await mountSuspended()
    const text = wrapper.text()

    expect(text).toContain('공공임대 · 일정 확인 필요')
    expect(text).toContain('공공임대 공급정보')
    expect(text).toContain('한국토지주택공사')
    expect(text).toContain('마이홈')
    expect(text).toContain('LH')
    expect(text).toContain('강남권 국민임대')
    expect(text).toContain('서울 강남구')
    expect(text).toContain('24호')
    expect(text).toContain('최소 보증금')
    expect(text).toContain('최소 월임대료')
    expect(text).toContain('1,200만원')
    expect(text).toContain('18만원')
    expect(text).toContain('2026-10-01 ~ 2026-10-08')
    expect(text).toContain('원문 확인')
    expect(wrapper.find('[data-testid="facility-map"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rental-price-stats"]').exists()).toBe(false)
    expect(text).not.toContain('면적별 공급정보')
    expect(text).not.toContain('면적별 경쟁률')
    expect(setBreadcrumbSchemaMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: '임대', url: expect.stringContaining('/subscription/rent') }),
    ]))
  })


  it('렌더 중 콘솔 에러가 없다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountSuspended()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
