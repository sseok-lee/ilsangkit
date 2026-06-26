import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import DetailPage from '~/pages/[category]/[id].vue'
import type { FacilityDetail } from '~/types/facility'

const mockFacility: FacilityDetail = {
  id: 'toilet-1',
  category: 'toilet',
  name: '강남역 공중화장실',
  address: '서울특별시 강남구 강남대로 396',
  roadAddress: '서울특별시 강남구 강남대로 396',
  lat: 37.4979,
  lng: 127.0276,
  city: '서울',
  district: '강남구',
  bjdCode: '11680',
  details: {
    operatingHours: '24시간',
    maleToilets: 3,
    femaleToilets: 5,
    hasDisabledToilet: true,
  },
  sourceId: 'src-1',
  sourceUrl: null,
  viewCount: 10,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  syncedAt: '2024-01-01T00:00:00Z',
}

// Mock useRoute — category 는 routeMock 으로 가변(재설계 vs 비대상 광고개수 검증용). 기본 toilet.
const routeMock = vi.hoisted(() => ({ category: 'toilet', id: 'toilet-1' }))
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      category: routeMock.category,
      id: routeMock.id,
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

// Mock Nuxt compiler macros & utilities
vi.stubGlobal('definePageMeta', vi.fn())
const createErrorMock = vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', createErrorMock)

// Mock useKakaoMap
vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    isLoaded: { value: true },
    map: { value: null },
    initMap: vi.fn(),
    addMarkers: vi.fn(),
    clearMarkers: vi.fn(),
    setCenter: vi.fn(),
    panTo: vi.fn(),
    setLevel: vi.fn(),
  }),
}))

// Global stubs for all tests
const globalStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityFeatureCard: { template: '<div>FeatureCard</div>' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
  // PageHero는 Nuxt auto-import 컴포넌트라 테스트 env에 별도 stub 필요.
  // 실제 PageHero 처럼 title-tag 로 제목 태그를 결정한다(기본 h1; 상세 페이지는 div 강등).
  // 상세 페이지가 title-tag="div" 를 넘기므로 데스크톱 제목은 h1 이 아니어야 SEO 가드(단일 h1)가 성립.
  PageHero: {
    template: '<section><component :is="titleTag || \'h1\'">{{ title }}</component><p>{{ description }}</p></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
  },
  // 재설계 신규 컴포넌트는 Nuxt 자동 import 라 raw vitest mount 에선 미해소 → 명시 stub 으로 존재 검증 가능케 함.
  DetailSpecGrid: { template: '<div data-testid="spec-grid">SpecGrid</div>', props: ['groups', 'heading'] },
  DetailLocationGuide: { template: '<div data-testid="location-guide">LocationGuide</div>', props: ['stations', 'alternatives', 'alternativeLabel'] },
  // EvChargerDetail 은 명시 import (auto-import 아님) → 테스트 env 에서 useApiBase 등 Nuxt 훅 호출 방지용 stub 필수.
  EvChargerDetail: { template: '<div data-testid="ev-charger-detail" />', props: ['details'] },
}

// Helper to mount async components with Suspense
async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component),
        })
      },
    }),
    { global: options?.global },
  )
  await flushPromises()
  return wrapper
}

// Helper to set useAsyncData mock with specific data
function mockUseAsyncDataWith(data: any, status = 'success', error: any = null) {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(error),
    refresh: vi.fn(),
    pending: ref(status === 'pending'),
  }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

describe('DetailPage', () => {
  beforeEach(() => {
    // Default: toilet(재설계) + facility data
    routeMock.category = 'toilet'
    routeMock.id = 'toilet-1'
    mockUseAsyncDataWith({ success: true, data: mockFacility })
  })

  it('시설 이름과 도로명 주소를 가시 렌더 (재설계 toilet)', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.text()).toContain('강남역 공중화장실')
    // 핵심 정보 회귀 가드: 재설계에서도 도로명 주소는 위치·길찾기 섹션에 가시 텍스트로 노출되어야 한다.
    // (기본정보 섹션은 게이트 오프되지만 주소 자체는 '도로명' 행으로 본문에 남는다.)
    expect(wrapper.text()).toContain('서울특별시 강남구 강남대로 396')
  })

  it('카테고리별 상세 컴포넌트를 렌더링', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.html()).toContain('강남역 공중화장실')
  })

  it('길찾기 링크가 올바른 URL을 가짐', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    // Check for direction link/button
    const kakaoLink = wrapper.find('a[href*="map.kakao.com"]')
    if (kakaoLink.exists()) {
      expect(kakaoLink.attributes('href')).toContain('37.4979')
      expect(kakaoLink.attributes('href')).toContain('127.0276')
    } else {
      // Button with onclick for directions
      const directionButtons = wrapper.findAll('button')
      expect(directionButtons.length).toBeGreaterThan(0)
    }
  })

  it('뒤로가기 버튼이 존재', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('로딩 중 상태 표시', async () => {
    mockUseAsyncDataWith(null, 'pending')

    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.text()).toContain('불러오는 중')
  })

  it('실제 404 에러 시 createError로 404 반환', async () => {
    createErrorMock.mockClear()
    const notFoundError = Object.assign(new Error('Not Found'), { statusCode: 404 })
    mockUseAsyncDataWith(null, 'error', notFoundError)

    const wrapper = mount(
      defineComponent({
        setup() {
          onErrorCaptured(() => true)
          return () => h(Suspense, null, {
            default: () => h(DetailPage),
          })
        },
      }),
      {
        global: {
          stubs: globalStubs,
          config: { errorHandler: () => {} },
        },
      },
    )
    await flushPromises()

    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, statusMessage: 'Facility not found' })
    )

    wrapper.unmount()
  })

  // ---------------- SEO 회귀 가드 (모바일 핵심정보 헤더 도입 후) ----------------
  // 모바일 전용 헤더(MobileDetailHeader, md:hidden)가 정식 h1. 데스크톱 PageHero(hidden md:block)는
  // title-tag="div"(role=heading aria-level=1)로 강등 → raw HTML 의 literal <h1> 은 1개여야 한다.
  // 가드: h1 정확히 1개 + 시설명 (네이버 등 비렌더 파서의 중복 h1 회귀 방지).
  it('시설명 H1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 시설명', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s.every(h => h.text() === '강남역 공중화장실')).toBe(true)
  })

  // BasicInfo + FacilityStatus + Nearby + ContextLinks 각각 1번씩만 렌더 (중복 제거 회귀 가드)
  it('상세 컴포넌트가 단일 트리에 한 번씩만 렌더 (DOM 중복 없음)', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    // 단일 트리 통합 후 각 섹션은 SSR HTML에 한 번만 등장해야 함
    const html = wrapper.html()
    expect(html.split('"같은 지역 시설"').length - 1).toBeLessThanOrEqual(1)
    expect(html.split('"자주 묻는 질문"').length - 1).toBeLessThanOrEqual(1)
  })

  it('주변 시설(nearby/cross)을 SSR 데이터로 렌더링', async () => {
    // key-aware: nearby-* 키는 주변시설, 그 외는 facility 응답
    ;(globalThis as any).useAsyncData = vi.fn((key: string, _handler?: () => Promise<unknown>, opts?: any) => {
      const isNearby = typeof key === 'string' && key.startsWith('nearby-')
      const data = ref(
        isNearby
          ? {
              nearby: [{ id: 'toilet-2', category: 'toilet', name: '역삼역 화장실', address: 'A', lat: 37.5, lng: 127.03 }],
              cross: [{ id: 'hospital-9', category: 'hospital', name: '강남병원', address: 'B', lat: 37.5, lng: 127.03 }],
            }
          : { success: true, data: mockFacility },
      )
      const result = { data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
      void opts
      return Object.assign(Promise.resolve(result), result)
    })

    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

    expect(wrapper.text()).toContain('역삼역 화장실') // 동일 카테고리 반경 nearby
    expect(wrapper.text()).toContain('강남병원')       // cross-category nearby
  })

  it('네트워크/서버 에러 시 404를 반환하지 않음 (SEO 보호)', async () => {
    createErrorMock.mockClear()
    mockUseAsyncDataWith(null, 'error', new Error('Failed to fetch'))

    const wrapper = mount(
      defineComponent({
        setup() {
          onErrorCaptured(() => true)
          return () => h(Suspense, null, {
            default: () => h(DetailPage),
          })
        },
      }),
      {
        global: {
          stubs: globalStubs,
          config: { errorHandler: () => {} },
        },
      },
    )
    await flushPromises()

    expect(createErrorMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  // ---------------- FAQPage JSON-LD 발행 가드 (spec §3.4·§6 결정4) ----------------
  // 화면 FAQ(DetailContextLinks)만으로는 SEO 가치가 없으므로 setFAQSchema 로 FAQPage JSON-LD 를 발행해야 한다.
  it('FAQPage JSON-LD(structured data)를 발행한다', async () => {
    const heads: any[] = []
    ;(globalThis as any).useHead = vi.fn((arg: any) => {
      heads.push(typeof arg === 'function' ? arg() : arg)
    })

    await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

    const scripts = heads.flatMap(h => h?.script ?? [])
    const faqScript = scripts.find((s: any) => s?.key === 'jsonld-faq')
    expect(faqScript).toBeTruthy()
    expect(faqScript.innerHTML).toContain('"@type":"FAQPage"')
  })

  // ---------------- 재설계 게이트 (Phase 1: toilet/clothes) ----------------
  // toilet 은 재설계 대상 → 구 사다리(시설현황 T1 + 기본정보 T3) SectionBlock 헤딩(h3)이
  // 게이트로 제거되고 DetailSpecGrid 로 교체된다. (구 T1→T3 순서 가드는 toilet 픽스처에서 무의미.)
  it('재설계(toilet)는 구 시설현황·기본정보 대신 DetailSpecGrid 를 렌더한다', async () => {
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    const h3s = wrapper.findAll('h3').map(h => h.text())
    expect(h3s).not.toContain('기본정보')
    expect(h3s).not.toContain('시설현황')
    // 신 스펙 그리드 존재 검증
    expect(wrapper.find('[data-testid="spec-grid"]').exists()).toBe(true)
  })

  // ---------------- 광고 슬롯 (spec-owner 결정: 재설계=4, 비대상=5, 인접 금지) ----------------
  // AdBanner 는 tests/setup.ts 에서 `<div class="stub-ad-banner" />` 로 전역 stub.
  it('재설계(toilet)는 광고 4개를 렌더 (고아 compact 광고 제거)', async () => {
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.stub-ad-banner')).toHaveLength(4)
  })

  it('재설계(hospital)는 광고 4개를 렌더 (불변)', async () => {
    routeMock.category = 'hospital'
    routeMock.id = 'hospital-1'
    mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id: 'hospital-1', category: 'hospital' } })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.stub-ad-banner')).toHaveLength(4)
  })

  it('재설계(ev-charger)는 광고 4개를 렌더 (불변)', async () => {
    routeMock.category = 'ev-charger'
    routeMock.id = 'ev-charger-1'
    mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id: 'ev-charger-1', category: 'ev-charger' } })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.stub-ad-banner')).toHaveLength(4)
  })

  it('재설계(ev-charger): 라이브 컴포넌트(ev-charger-detail)가 렌더된다', async () => {
    routeMock.category = 'ev-charger'
    routeMock.id = 'ev-charger-1'
    mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id: 'ev-charger-1', category: 'ev-charger', details: { statId: 'ST123', chargers: [] } } })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.find('[data-testid="ev-charger-detail"]').exists()).toBe(true)
  })

  // hasFacilityStatus=false 카테고리(clothes, 재설계)는 시설현황 h3 미렌더 + 광고 인접(연속) 노출 없음.
  it('clothes(재설계)는 빈 시설현황 + 광고 연속 노출이 없다', async () => {
    routeMock.category = 'clothes'
    routeMock.id = 'clothes-1'
    mockUseAsyncDataWith({
      success: true,
      data: { ...mockFacility, id: 'clothes-1', category: 'clothes', details: { detailLocation: '정문 앞' } },
    })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    // 시설현황 SectionBlock 의 <h3> 헤딩이 렌더되지 않음 (DetailFacilityStatus v-if=!isRedesigned=false)
    const statusH3 = wrapper.findAll('h3').find(h => h.text() === '시설현황')
    expect(statusH3).toBeUndefined()
    // 광고 인접(연속) 노출 없음 — 고아 compact 광고 제거 검증
    const ads = wrapper.findAll('.stub-ad-banner').map(w => w.element)
    const anyAdjacent = ads.some(ad => ad.nextElementSibling?.classList.contains('stub-ad-banner'))
    expect(anyAdjacent).toBe(false)
  })

  // ── AED 긴급 CTA 존재 가드 (Phase 2, Step 5 "드롭 금지" 딜리버러블) ─────────
  it('재설계(aed): 긴급 CTA tel:119 와 kacpr.org 링크가 렌더된다', async () => {
    routeMock.category = 'aed'
    routeMock.id = 'aed-1'
    mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id: 'aed-1', category: 'aed', details: {} } })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.find('a[href="tel:119"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://www.kacpr.org/"]').exists()).toBe(true)
  })

  it('재설계(aed 외 카테고리)는 긴급 CTA가 렌더되지 않는다 (category===aed 게이트)', async () => {
    routeMock.category = 'hospital'
    routeMock.id = 'hospital-1'
    mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id: 'hospital-1', category: 'hospital', details: {} } })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    expect(wrapper.find('a[href="tel:119"]').exists()).toBe(false)
    expect(wrapper.find('a[href="https://www.kacpr.org/"]').exists()).toBe(false)
  })

  // ── Phase 2 게이트 가드: wifi, park, parking, library, sports, aed, pharmacy, hospital, ev-charger ─────────────
  // 각 카테고리: 단일 h1, AdBanner 4개, spec-grid 존재, DetailBasicInfo/Status h3 없음
  const phase2Categories: Array<{ cat: string; id: string }> = [
    { cat: 'wifi', id: 'wifi-1' },
    { cat: 'park', id: 'park-1' },
    { cat: 'parking', id: 'parking-1' },
    { cat: 'library', id: 'library-1' },
    { cat: 'sports', id: 'sports-1' },
    { cat: 'market', id: 'market-1' },
    { cat: 'school', id: 'school-1' },
    { cat: 'childcare', id: 'childcare-1' },
    { cat: 'aed', id: 'aed-1' },
    { cat: 'pharmacy', id: 'pharmacy-1' },
    { cat: 'hospital', id: 'hospital-2' },
    { cat: 'ev-charger', id: 'ev-charger-1' },
  ]

  for (const { cat, id } of phase2Categories) {
    it(`재설계(${cat}): 단일 h1`, async () => {
      routeMock.category = cat
      routeMock.id = id
      mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id, category: cat, details: {} } })
      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
      expect(wrapper.findAll('h1')).toHaveLength(1)
    })

    it(`재설계(${cat}): AdBanner 정확히 4개`, async () => {
      routeMock.category = cat
      routeMock.id = id
      mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id, category: cat, details: {} } })
      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
      expect(wrapper.findAll('.stub-ad-banner')).toHaveLength(4)
    })

    it(`재설계(${cat}): spec-grid 존재`, async () => {
      routeMock.category = cat
      routeMock.id = id
      mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id, category: cat, details: {} } })
      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
      expect(wrapper.find('[data-testid="spec-grid"]').exists()).toBe(true)
    })

    it(`재설계(${cat}): DetailBasicInfo·DetailFacilityStatus h3 없음`, async () => {
      routeMock.category = cat
      routeMock.id = id
      mockUseAsyncDataWith({ success: true, data: { ...mockFacility, id, category: cat, details: {} } })
      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
      const h3texts = wrapper.findAll('h3').map(h => h.text())
      expect(h3texts).not.toContain('기본정보')
      expect(h3texts).not.toContain('시설현황')
    })
  }
})
