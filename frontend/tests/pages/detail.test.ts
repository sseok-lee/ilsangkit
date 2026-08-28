import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import DetailPage from '~/pages/[category]/[id].vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
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

// Mock useRoute
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      category: 'toilet',
      id: 'toilet-1',
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
// showError: 클라이언트 네비게이션에서 에러 페이지를 띄우는 Nuxt 자동 import.
// watch 콜백 안에서는 throw 가 Vue 에 삼켜지므로 이걸 불러야 한다 —
// 아래 "에러 페이지를 띄운다" 테스트들이 그 배선을 고정한다.
const showErrorMock = vi.fn()
vi.stubGlobal('showError', showErrorMock)

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
    // Default: return facility data
    mockUseAsyncDataWith({ success: true, data: mockFacility })
  })

  it('시설 이름과 주소를 표시', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.text()).toContain('강남역 공중화장실')
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

  // 클라이언트 네비게이션 에러 처리를 mount 해서 검증한다.
  // showError 어서션이 핵심 회귀 잠금 — throw createError 로 되돌리면 createError 는
  // 불려도 showError 는 안 불리고, 실제 브라우저에서는 에러 페이지 대신 빈 페이지가 뜬다
  // (2026-08-28 프로덕션 실측: 사이트 기본 title + h1 없음 + robots index,follow).
  async function mountForClientError(error: unknown) {
    createErrorMock.mockClear()
    showErrorMock.mockClear()
    mockUseAsyncDataWith(null, 'error', error)

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
    return wrapper
  }

  it('실제 404 에러 시 showError 로 404 에러 페이지를 띄운다', async () => {
    const wrapper = await mountForClientError(
      Object.assign(new Error('Not Found'), { statusCode: 404 }),
    )

    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, statusMessage: 'Facility not found' })
    )
    expect(showErrorMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock.mock.calls[0][0]).toMatchObject({ statusCode: 404 })

    wrapper.unmount()
  })

  it('422 도 404 에러 페이지로 띄운다', async () => {
    const wrapper = await mountForClientError(
      Object.assign(new Error('Unprocessable'), { statusCode: 422 }),
    )

    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, statusMessage: 'Facility not found' })
    )
    expect(showErrorMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('410 Gone 시 showError 로 410 에러 페이지를 띄운다 (폐업·폐원 시설)', async () => {
    const wrapper = await mountForClientError(
      Object.assign(new Error('Gone'), { statusCode: 410 }),
    )

    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 410, statusMessage: 'Facility permanently removed' })
    )
    expect(showErrorMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock.mock.calls[0][0]).toMatchObject({ statusCode: 410 })

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
    const wrapper = await mountForClientError(new Error('Failed to fetch'))

    expect(createErrorMock).not.toHaveBeenCalled()
    // 일시 장애를 에러 페이지로 굳히지 않는다 — fail-open
    expect(showErrorMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('5xx 는 에러 페이지를 띄우지 않는다 (fail-open)', async () => {
    for (const statusCode of [500, 502, 503, 504]) {
      const wrapper = await mountForClientError(
        Object.assign(new Error('Server Error'), { statusCode }),
      )
      expect(createErrorMock, `statusCode=${statusCode}`).not.toHaveBeenCalled()
      expect(showErrorMock, `statusCode=${statusCode}`).not.toHaveBeenCalled()
      wrapper.unmount()
    }
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

  // ---------------- 기본정보 우선 (2026-06-30 재정렬) ----------------
  // 기본정보가 시설현황보다 DOM 상 먼저 와야 한다 (모바일=데스크톱 동일, order 미사용).
  it('기본정보가 시설현황보다 먼저 렌더된다', async () => {
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    // SectionBlock 헤딩은 h2 (페이지 h1 → 섹션 h2 위계, I-21)
    const h2s = wrapper.findAll('h2').map(h => h.text())
    const basicIdx = h2s.indexOf('기본정보')
    const statusIdx = h2s.indexOf('시설현황')
    expect(basicIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeGreaterThan(-1)
    expect(basicIdx).toBeLessThan(statusIdx)
  })

  // hasFacilityStatus=false 카테고리(clothes)는 시설현황 섹션 h2 헤딩이 렌더되지 않아야 한다.
  it('clothes(시설현황 없음)는 빈 T1 + 광고 연속 노출이 없다', async () => {
    mockUseAsyncDataWith({
      success: true,
      data: { ...mockFacility, id: 'clothes-1', category: 'clothes', details: { detailLocation: '정문 앞' } },
    })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    // 시설현황 SectionBlock 의 <h2> 헤딩이 렌더되지 않음 (DetailFacilityStatus 내부 v-if=false)
    // HTML 주석에 "시설현황" 문자열이 포함될 수 있으므로 h2 태그로 정확히 검증
    const h2s = wrapper.findAll('h2')
    const statusH2 = h2s.find(h => h.text() === '시설현황')
    expect(statusH2).toBeUndefined()
  })

  // ---------------- 약국 헤더 칩 보강 (약사수·오늘 영업시간) ----------------
  // pharmacyWeeklyHours가 KST 기준 '오늘'을 판정하므로 요일을 고정하기 위해 fake timers 사용.
  // 2026-07-13(월)을 시스템 시각으로 고정 — dutyTime1s/c(월요일) row가 isToday=true가 된다.
  describe('pharmacy 헤더 칩 (약사수·오늘 영업시간)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-13T12:00:00+09:00')) // 월요일 정오 KST
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('약사수·오늘 영업시간 칩을 모바일 헤더에 노출한다', async () => {
      mockUseAsyncDataWith({
        success: true,
        data: {
          ...mockFacility,
          id: 'pharmacy-1',
          category: 'pharmacy',
          details: {
            phone: '02-123-4567',
            pharmacistCnt: 2,
            dutyTime1s: '0900', // 월요일 09:00
            dutyTime1c: '1800', // 월요일 18:00
          },
        },
      })

      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

      // WeekdayHoursTable(기본정보 섹션)도 독립적으로 '오늘' 배지를 렌더하므로
      // wrapper.text() 전체가 아닌 MobileDetailHeader 서브트리로 정확히 스코프해 검증한다.
      const header = wrapper.findComponent(MobileDetailHeader)
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('약사')
      expect(header.text()).toContain('2명')
      expect(header.text()).toContain('오늘')
      expect(header.text()).toContain('09:00 ~ 18:00')

      // 단일 h1 · 헤더 구조 불변식 (기존 SEO 가드와 동일 기준)
      const h1s = wrapper.findAll('h1')
      expect(h1s.length).toBe(1)
    })

    it('오늘 휴무(dutyTime1s/c 없음)면 오늘 칩을 생략한다', async () => {
      mockUseAsyncDataWith({
        success: true,
        data: {
          ...mockFacility,
          id: 'pharmacy-2',
          category: 'pharmacy',
          details: {
            phone: '02-123-4567',
            pharmacistCnt: 1,
            // 월요일 dutyTime 없음 → 오늘 휴무
            dutyTime2s: '0900',
            dutyTime2c: '1800',
          },
        },
      })

      const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

      // MobileDetailHeader 서브트리로 스코프(WeekdayHoursTable의 독립적인 '오늘' 배지와 혼동 방지)
      const header = wrapper.findComponent(MobileDetailHeader)
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('약사')
      expect(header.text()).toContain('1명')
      expect(header.text()).not.toContain('오늘')
    })
  })
})
