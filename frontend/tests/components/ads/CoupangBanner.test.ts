import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import CoupangBanner, { COUPANG_DISCLOSURE } from '~/components/ads/CoupangBanner.vue'
import DetailPage from '~/pages/[category]/[id].vue'
import SubwayDetailPage from '~/pages/subway/[slug].vue'
import type { FacilityDetail } from '~/types/facility'
import type { SubwayStation } from '~/types/subway'

describe('CoupangBanner', () => {
  it('renders Coupang Partners disclosure below the banner', () => {
    const wrapper = mount(CoupangBanner)

    expect(wrapper.text()).toContain(
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    )
  })

  it('links to the Coupang promotion deep link', () => {
    const wrapper = mount(CoupangBanner)
    const link = wrapper.find('a')

    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://link.coupang.com/a/e9vQESWMTc')
  })

  it('opens the promotion in a new tab with affiliate-safe rel attributes', () => {
    const wrapper = mount(CoupangBanner)
    const link = wrapper.find('a')

    expect(link.attributes('target')).toBe('_blank')
    const rel = link.attributes('rel') ?? ''
    expect(rel).toContain('sponsored')
    expect(rel).toContain('nofollow')
    expect(rel).toContain('noopener')
  })

  it('renders the Coupang-supplied banner image with reserved dimensions', () => {
    const wrapper = mount(CoupangBanner)
    const img = wrapper.find('img')

    expect(img.exists()).toBe(true)
    // 런타임 sharp/IPX 미지원 서버 대응: /public/ads 의 사전최적화 webp를 정적 서빙
    expect(img.attributes('src')).toBe('/ads/coupang-summer-lodging-festa.webp')
    expect(img.attributes('width')).toBe('1000')
    expect(img.attributes('height')).toBe('1000')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt') ?? '').not.toBe('')
  })
})

// ─── [결함 7] disclosure prop (기본 true, 페이지당 1회 통합용) ─────────────────
describe('CoupangBanner disclosure prop', () => {
  it('COUPANG_DISCLOSURE 상수를 export 한다 (drift 방지)', () => {
    expect(COUPANG_DISCLOSURE).toBe(
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    )
  })

  it('disclosure prop 미지정 시 기본값 true — 고지문 렌더 (단일 배너 페이지 무변경)', () => {
    const wrapper = mount(CoupangBanner)
    expect(wrapper.text()).toContain(COUPANG_DISCLOSURE)
  })

  it(':disclosure="true" 명시 시에도 고지문 렌더', () => {
    const wrapper = mount(CoupangBanner, { props: { disclosure: true } })
    expect(wrapper.text()).toContain(COUPANG_DISCLOSURE)
  })

  it(':disclosure="false" 시 고지문 미렌더 (광고 이미지/링크는 유지)', () => {
    const wrapper = mount(CoupangBanner, { props: { disclosure: false } })
    expect(wrapper.text()).not.toContain(COUPANG_DISCLOSURE)
    // 광고 슬롯 자체(이미지·링크)는 disclosure 여부와 무관하게 항상 렌더
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('a').exists()).toBe(true)
  })
})

// ─── 페이지 회귀: 실제 마운트로 고지문 1회 + 배너 2개 불변 검증 ──────────────────
// tests/setup.ts의 CoupangBanner 전역 stub(`<div class="stub-coupang-banner" />`)은
// 고지문을 렌더하지 않으므로, 여기서는 stub을 "실제 컴포넌트"로 교체해 우회한다.
// [category]/[id].vue는 CoupangBanner를 로컬 import하지 않고 Nuxt 자동 임포트에 의존하므로
// Suspense 하위에서 resolveComponent 글로벌 조회가 깨진다 — stubs 값에 실제 컴포넌트 객체를
// 넘기는 방식(VTU stub override)으로 우회한다(components 옵션으로는 재현 불가 확인됨).

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
} as unknown as FacilityDetail

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { category: 'toilet', id: 'toilet-1' },
  }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.stubGlobal('definePageMeta', vi.fn())
const createErrorMock = vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', createErrorMock)

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

const categoryPageStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityFeatureCard: { template: '<div>FeatureCard</div>' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
  PageHero: {
    template: '<section><component :is="titleTag || \'h1\'">{{ title }}</component><p>{{ description }}</p></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
  },
  // 실제 CoupangBanner 컴포넌트로 stub을 교체 — setup.ts 기본 stub 우회
  CoupangBanner,
}

const subwayPageStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityRoadview: { template: '<div data-testid="roadview" />' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
  PageHero: {
    template: '<section><component :is="titleTag || \'h1\'">{{ title }}</component><p>{{ description }}</p></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
  },
  CoupangBanner,
}

const mockStation: SubwayStation = {
  id: 'st-1',
  sourceId: 'src-1',
  name: '강남',
  nameSlug: 'gangnam',
  line: '2호선',
  transferLines: [],
  operator: '서울교통공사',
  lat: 37.4979,
  lng: 127.0276,
  address: '서울특별시 강남구 강남대로',
  roadAddress: '서울특별시 강남구 강남대로',
  city: '서울',
  district: '강남구',
  regionSlug: 'seoul',
  phoneNumber: null,
  dataDate: '2024-01-01',
  updatedAt: '2024-01-01T00:00:00Z',
}

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

// subway/[slug].vue는 Nuxt 자동 임포트가 아닌 전역 useRoute() mock에 의존한다.
;(globalThis as any).useRoute = () => ({
  params: { slug: 'gangnam' },
  query: {},
  path: '/subway/gangnam',
  fullPath: '/subway/gangnam',
  name: 'subway-slug',
  hash: '',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
})

describe('[category]/[id].vue 쿠팡 고지문 페이지당 1회 (실제 마운트)', () => {
  it('고지문 문자열은 정확히 1회, CoupangBanner 인스턴스는 2개 유지', async () => {
    mockUseAsyncDataWith({ success: true, data: mockFacility })

    const wrapper = await mountSuspended(DetailPage, { global: { stubs: categoryPageStubs } })
    const html = wrapper.html()

    const disclosureCount = html.split(COUPANG_DISCLOSURE).length - 1
    expect(disclosureCount).toBe(1)

    expect(wrapper.findAllComponents(CoupangBanner as any).length).toBe(2)
  })
})

describe('subway/[slug].vue 쿠팡 고지문 페이지당 1회 (실제 마운트)', () => {
  it('고지문 문자열은 정확히 1회, CoupangBanner 인스턴스는 2개 유지', async () => {
    mockUseAsyncDataWith({ success: true, data: mockStation })
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [] } })

    const wrapper = await mountSuspended(SubwayDetailPage, { global: { stubs: subwayPageStubs } })
    const html = wrapper.html()

    const disclosureCount = html.split(COUPANG_DISCLOSURE).length - 1
    expect(disclosureCount).toBe(1)

    expect(wrapper.findAllComponents(CoupangBanner as any).length).toBe(2)
  })
})

// ─── 구조 회귀: 남긴 단일 고지문 <p>에 브레이크포인트 숨김 클래스가 없어야 한다 ─────
// (법적 요건 — 반대 뷰포트에서 광고는 보이는데 고지문만 사라지는 사고 방지)
describe('고지문 단일 <p> 브레이크포인트 숨김 클래스 가드 (소스 검사)', () => {
  const read = (p: string) => {
    const root = process.cwd().endsWith('/frontend') ? process.cwd() : resolve(process.cwd(), 'frontend')
    return readFileSync(resolve(root, p), 'utf8')
  }

  for (const page of ['pages/[category]/[id].vue', 'pages/subway/[slug].vue']) {
    it(`${page} — 단일 고지문 <p>는 md:hidden/hidden md:flex 없이 모든 뷰포트 노출`, () => {
      const src = read(page)
      // COUPANG_DISCLOSURE를 참조하는 <p> 태그를 찾아 class 속성을 검사
      const match = src.match(/<p([^>]*)>\s*\{\{\s*COUPANG_DISCLOSURE\s*\}\}\s*<\/p>/)
      expect(match, 'COUPANG_DISCLOSURE를 렌더하는 단일 <p> 가 있어야 함').toBeTruthy()
      const attrs = match?.[1] ?? ''
      expect(attrs).not.toMatch(/md:hidden/)
      expect(attrs).not.toMatch(/hidden md:flex/)
    })

    it(`${page} — 두 CoupangBanner 인스턴스 모두 :disclosure="false"`, () => {
      const src = read(page)
      const disclosureFalseCount = (src.match(/<CoupangBanner\b[^>]*:disclosure="false"/g) || []).length
      expect(disclosureFalseCount).toBe(2)
    })

    it(`${page} — CoupangBanner 태그(광고 슬롯)는 2개 그대로`, () => {
      const src = read(page)
      const count = (src.match(/<CoupangBanner\b/g) || []).length
      expect(count).toBe(2)
    })
  }
})
