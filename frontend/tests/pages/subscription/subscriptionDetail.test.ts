import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, defineComponent, h, Suspense } from 'vue'
import SubscriptionDetail from '~/pages/subscription/[id].vue'

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
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setEventSchema: vi.fn() }),
}))
vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackSubscriptionView: vi.fn() }),
}))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
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
  RentalPriceStatsBox: { template: '<div />', props: ['subscriptionId', 'regionName'] },
  RelatedGuides: { template: '<div data-testid="related-guides" />', props: ['categories', 'limit'] },
  DataSourceSection: { template: '<div data-testid="data-source" />', props: ['domain'] },
  AdBanner: { template: '<div data-testid="ad-banner" />' },
  SectionBlock: { template: '<section><h2 v-if="heading">{{ heading }}</h2><slot name="right" /><slot /></section>', props: ['heading', 'subtext'] },
  // 공용 헤더: 실제처럼 literal h1 1개 + eyebrow 노출 (단일 h1 가드 의미 유지)
  MobileDetailHeader: {
    template: '<section class="md:hidden"><span v-if="eyebrow">{{ eyebrow }}</span><h1>{{ title }}</h1></section>',
    props: ['title', 'eyebrow', 'status', 'stats', 'phone', 'copyable', 'hideDirections', 'kakaoMapUrl', 'naverMapUrl'],
  },
  // PageHero: title-tag로 제목 태그 결정(상세는 div 강등 → h1 아님)
  PageHero: {
    template: '<section class="hidden md:block"><component :is="titleTag || \'h1\'">{{ title }}</component></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
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

describe('subscription/[id].vue 섹션 재배치', () => {
  beforeEach(() => {
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

  it('렌더 중 콘솔 에러가 없다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountSuspended()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
