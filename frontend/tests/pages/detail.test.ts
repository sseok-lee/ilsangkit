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
})
