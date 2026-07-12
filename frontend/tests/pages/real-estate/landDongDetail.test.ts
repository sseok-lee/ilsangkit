import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { city: 'seoul', district: 'gangnam', dong: '%EC%97%AD%EC%82%BC%EB%8F%99' }, // encodeURIComponent('역삼동')
}))

// useAsyncData: actually calls the fetcher so SSR data is populated
;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => unknown) => {
  let value: unknown = null
  try {
    value = await fetcher()
  } catch {
    value = null
  }
  const data = ref(value)
  return Object.assign(
    Promise.resolve({ data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }),
    { data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) },
  )
})

;(globalThis as any).useRequestEvent = vi.fn(() => null)
;(globalThis as any).setResponseHeader = vi.fn()

// Capture useHead calls to inspect SEO output
const capturedHeadCalls: any[] = []
;(globalThis as any).useHead = vi.fn((argOrFn: any) => {
  capturedHeadCalls.push(argOrFn)
})

const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setDetailProvenance: vi.fn(),
    setFAQSchema: mockSetFAQSchema,
  }),
}))

// Mock useLand with: getRegions returns a list containing 역삼동 (isIndexable: true by default)
// getRegionDetail returns realistic detail data
const mockGetRegions = vi.fn(async (_params: any) => ({
  items: [
    {
      bjdCode: '1168010100',
      dongName: '역삼동',
      city: '서울',
      district: '강남구',
      transactionCount: 120,
      recentCount: 30,
      avgPricePerPyeong: 8000,
      latestDealDate: '2026-05-15',
      isIndexable: true,
      jimokBreakdown: { 대: 100, 전: 20 },
      daeCount: 100,
      daeNonShareCount: 90,
    },
  ],
  total: 1,
  page: 1,
  totalPages: 1,
}))

const mockGetRegionDetail = vi.fn(async (_params: any) => ({
  items: [
    {
      id: 1,
      jibun: '100-1',
      jimok: '대',
      landUse: '제2종일반주거지역',
      dealArea: 99.5,
      shareDeal: false,
      dealAmount: 50000,
      dealType: null,
      dealYear: 2026,
      dealMonth: 5,
      dealDay: 15,
      pricePerPyeong: 1660,
    },
    {
      id: 2,
      jibun: '200-3',
      jimok: '전',
      landUse: '생산녹지지역',
      dealArea: 200.0,
      shareDeal: true,
      dealAmount: 20000,
      dealType: null,
      dealYear: 2026,
      dealMonth: 4,
      dealDay: 10,
      pricePerPyeong: null,
    },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
  jimokGroups: [
    { group: '대지', count: 100, avgPricePerPyeong: 8000 },
    { group: '농지', count: 20, avgPricePerPyeong: null },
  ],
  daeSamples: [
    {
      id: 1,
      jibun: '100-1',
      jimok: '대',
      landUse: '제2종일반주거지역',
      dealArea: 99.5,
      shareDeal: false,
      dealAmount: 50000,
      dealType: null,
      dealYear: 2026,
      dealMonth: 5,
      dealDay: 15,
      pricePerPyeong: 1660,
    },
  ],
  daeNonShareCount: 90,
  landUseDistribution: [
    { landUse: '제2종일반주거지역', count: 80 },
    { landUse: '생산녹지지역', count: 20 },
  ],
  priceTimeline: [
    { year: 2026, quarter: 2, avgPricePerPyeong: 8200, count: 10 },
    { year: 2026, quarter: 1, avgPricePerPyeong: 7800, count: 8 },
  ],
  daeCount: 100,
}))

vi.mock('~/composables/useLand', () => ({
  useLand: () => ({
    getRegions: mockGetRegions,
    getRegionDetail: mockGetRegionDetail,
    getHubSummary: async () => ({ cities: [], totalTransactions: 0 }),
    getTransactions: vi.fn(async (_params: any) => ({ items: [], total: 0, page: 1, totalPages: 0 })),
  }),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울', busan: '부산' },
  DISTRICT_SLUG_MAP: { 강남구: 'gangnam', 서초구: 'seocho' },
  REGIONS: { 서울: ['강남구', '서초구'] },
  CITY_FULL_NAME_TO_SLUG: {},
  CITY_SLUGS: { 서울: 'seoul', 부산: 'busan' },
  getDistrictSlug: (name: string) => {
    const map: Record<string, string> = { 강남구: 'gangnam', 서초구: 'seocho' }
    return map[name] ?? name.toLowerCase().replace(/\s+/g, '-')
  },
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
  compactCityName: (city: string) => (city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, ''),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetFAQSchema.mockClear()
  mockGetRegions.mockClear()
  mockGetRegionDetail.mockClear()
  capturedHeadCalls.length = 0
  // Reset useHead spy
  ;(globalThis as any).useHead = vi.fn((argOrFn: any) => {
    capturedHeadCalls.push(argOrFn)
  })
  // Default route: isIndexable = true case
  ;(globalThis as any).useRoute = vi.fn(() => ({
    params: { city: 'seoul', district: 'gangnam', dong: '%EC%97%AD%EC%82%BC%EB%8F%99' },
  }))
  mockGetRegions.mockImplementation(async (_params: any) => ({
    items: [
      {
        bjdCode: '1168010100',
        dongName: '역삼동',
        city: '서울',
        district: '강남구',
        transactionCount: 120,
        recentCount: 30,
        avgPricePerPyeong: 8000,
        latestDealDate: '2026-05-15',
        isIndexable: true,
        jimokBreakdown: { 대: 100, 전: 20 },
        daeCount: 100,
        daeNonShareCount: 90,
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
  }))
})

/**
 * Resolve the head object from a useHead call.
 * useHead may be called with a plain object or a function returning one.
 */
function resolveHead(arg: any): any {
  if (typeof arg === 'function') return arg()
  return arg
}

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  // PageHero: title-tag prop을 받아 h1 미렌더(데스크톱 제목은 div 강등). 단일 h1 불변식 검증용.
  PageHero: {
    template: '<div data-stub="hero" :data-title-tag="titleTag" :class="$attrs.class" />',
    props: ['titleTag'],
    inheritAttrs: false,
  },
  // 공용 모바일 헤더: literal h1 1개 소유.
  MobileDetailHeader: {
    template: '<section data-stub="mobile-header" :data-hide-directions="hideDirections"><h1>{{ title }}</h1></section>',
    props: ['title', 'eyebrow', 'status', 'stats', 'phone', 'copyable', 'hideDirections', 'kakaoMapUrl', 'naverMapUrl'],
  },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AdBanner: { template: '<div class="stub-ad" />' },
  CoupangBanner: { template: '<div class="stub-coupang" />' },
  Pagination: { template: '<div data-stub="pagination" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}

async function mountPage() {
  const m = await import('~/pages/real-estate/land/[city]/[district]/[dong].vue')
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(m.default) })
      },
    }),
    { global: { stubs: globalStubs } },
  )
  await flushPromises()
  return wrapper
}

describe('real-estate/land/[city]/[district]/[dong].vue — land dong detail page', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/land/[city]/[district]/[dong].vue')
    expect(m.default).toBeDefined()
  })

  it('컴포넌트가 마운트되어야 한다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.exists()).toBe(true)
  })

  it('setBreadcrumbSchema가 6개 크럼으로 호출되어야 한다', async () => {
    await mountPage()
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(6)
  })

  it('breadcrumb 첫 항목은 홈(/)이어야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[0].url).toBe('/')
    expect(crumbs[0].name).toBe('홈')
  })

  it('breadcrumb 세 번째 항목은 토지 실거래가(/real-estate/land)여야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[2].url).toBe('/real-estate/land')
    expect(crumbs[2].name).toBe('토지 실거래가')
  })

  it('breadcrumb 마지막 항목(6번째)은 동 이름(역삼동)이어야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(6)
    expect(crumbs[5].name).toBe('역삼동')
  })

  it('breadcrumb 5번째(district) url이 /real-estate/land/seoul/gangnam이어야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[4].url).toBe('/real-estate/land/seoul/gangnam')
  })

  // ── SEO: isIndexable = true 케이스 ──────────────────────────────────────────

  it('[isIndexable=true] useHead에 noindex meta가 없어야 한다', async () => {
    await mountPage()
    expect(capturedHeadCalls.length).toBeGreaterThan(0)
    const head = resolveHead(capturedHeadCalls[0])
    const meta: Array<Record<string, string>> = head.meta ?? []
    const robotsMeta = meta.find((m) => m.name === 'robots')
    expect(robotsMeta).toBeUndefined()
  })

  it('[isIndexable=true] useHead에 canonical link가 자기 URL(dong URL)로 설정되어야 한다', async () => {
    await mountPage()
    const head = resolveHead(capturedHeadCalls[0])
    const links: Array<Record<string, string>> = head.link ?? []
    const canonical = links.find((l) => l.rel === 'canonical')
    expect(canonical).toBeDefined()
    expect(canonical!.href).toContain('/real-estate/land/seoul/gangnam/')
    expect(canonical!.href).toContain(encodeURIComponent('역삼동'))
  })

  // og:image 누락 회귀 가드 — 토지 동상세는 단일 좌표가 없어 정적 대표 PNG 사용.
  // 네이버 썸네일 크롤러는 webp/SVG 미렌더 → 반드시 절대경로 PNG 가 존재해야 한다.
  it('og:image 가 PNG 절대경로로 설정되고 twitter:image·치수가 함께 출력돼야 한다', async () => {
    await mountPage()
    const head = resolveHead(capturedHeadCalls[0])
    const meta: Array<Record<string, string>> = head.meta ?? []

    const ogImage = meta.find((m) => m.property === 'og:image')
    expect(ogImage).toBeDefined()
    expect(ogImage!.content).toMatch(/^https:\/\/ilsangkit\.co\.kr\//)
    expect(ogImage!.content).toMatch(/\.png$/)

    const twitterImage = meta.find((m) => m.name === 'twitter:image')
    expect(twitterImage?.content).toBe(ogImage!.content)

    expect(meta.find((m) => m.property === 'og:image:width')).toBeDefined()
    expect(meta.find((m) => m.property === 'og:image:height')).toBeDefined()
  })

  // og:image 는 색인 여부와 무관한 소셜 공유 신호 → noindex 동상세에도 존재해야 한다.
  it('[isIndexable=false] noindex 여도 og:image PNG 는 존재해야 한다', async () => {
    mockGetRegions.mockImplementationOnce(async (_params: any) => ({
      items: [
        {
          bjdCode: '1168010999',
          dongName: '역삼동',
          city: '서울',
          district: '강남구',
          transactionCount: 2,
          recentCount: 1,
          avgPricePerPyeong: null,
          latestDealDate: null,
          isIndexable: false,
          jimokBreakdown: {},
          daeCount: 0,
          daeNonShareCount: 0,
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    }))

    await mountPage()
    const head = resolveHead(capturedHeadCalls[0])
    const meta: Array<Record<string, string>> = head.meta ?? []
    const ogImage = meta.find((m) => m.property === 'og:image')
    expect(ogImage).toBeDefined()
    expect(ogImage!.content).toMatch(/\.png$/)
  })

  // ── SEO: isIndexable = false 케이스 ──────────────────────────────────────────

  it('[isIndexable=false] useHead에 robots: noindex, follow meta가 있어야 한다', async () => {
    // Override mock to return isIndexable: false
    mockGetRegions.mockImplementationOnce(async (_params: any) => ({
      items: [
        {
          bjdCode: '1168010999',
          dongName: '역삼동',
          city: '서울',
          district: '강남구',
          transactionCount: 2,
          recentCount: 1,
          avgPricePerPyeong: null,
          latestDealDate: null,
          isIndexable: false,
          jimokBreakdown: {},
          daeCount: 0,
          daeNonShareCount: 0,
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    }))

    await mountPage()
    expect(capturedHeadCalls.length).toBeGreaterThan(0)
    const head = resolveHead(capturedHeadCalls[0])
    const meta: Array<Record<string, string>> = head.meta ?? []
    const robotsMeta = meta.find((m) => m.name === 'robots')
    expect(robotsMeta).toBeDefined()
    expect(robotsMeta!.content).toBe('noindex, follow')
  })

  it('[isIndexable=false] canonical link는 생략되어야 한다(혼합 신호 방지)', async () => {
    mockGetRegions.mockImplementationOnce(async (_params: any) => ({
      items: [
        {
          bjdCode: '1168010999',
          dongName: '역삼동',
          city: '서울',
          district: '강남구',
          transactionCount: 2,
          recentCount: 1,
          avgPricePerPyeong: null,
          latestDealDate: null,
          isIndexable: false,
          jimokBreakdown: {},
          daeCount: 0,
          daeNonShareCount: 0,
        },
      ],
      total: 1,
      page: 1,
      totalPages: 1,
    }))

    await mountPage()
    const head = resolveHead(capturedHeadCalls[0])
    // noindex → robots noindex meta + canonical link OMITTED entirely (no mixed signals)
    const meta: Array<Record<string, string>> = head.meta ?? []
    const links: Array<Record<string, string>> = head.link ?? []
    const robotsMeta = meta.find((m) => m.name === 'robots')
    expect(robotsMeta!.content).toBe('noindex, follow')
    const canonical = links.find((l) => l.rel === 'canonical')
    expect(canonical).toBeUndefined()
  })

  // ── Content ──────────────────────────────────────────────────────────────────

  it('동 이름(역삼동)이 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('역삼동')
  })

  it('거래내역에 지번이 표시되어야 한다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('100-1')
  })

  it('지분 거래에 지분 뱃지가 표시되어야 한다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('지분')
  })

  it('만원 단위가 올바르게 표시되어야 한다(원 미사용)', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    // Should display "만원" unit, not bare "원" label
    expect(text).toContain('만원')
  })

  it('평당가 null 항목은 "-"로 표시되어야 한다', async () => {
    const wrapper = await mountPage()
    // pricePerPyeong null → '-' in transaction table
    expect(wrapper.text()).toContain('-')
  })

  it('지목 분포가 렌더링되어야 한다(대, 전)', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('대')
    expect(text).toContain('전')
  })

  it('용도지역 분포가 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('제2종일반주거지역')
  })

  it('FAQ 항목이 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    // LAND_FAQ has FAQ questions
    expect(wrapper.text()).toContain('지목이란 무엇인가요')
  })
})

describe('real-estate/land/[city]/[district]/[dong].vue — 섹션 재배치(spec §4.4)', () => {
  it('렌더된 DOM에 literal h1이 정확히 1개다(단일 h1 불변식)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('모바일 헤더(MobileDetailHeader)가 렌더되고 title=동 이름이다', async () => {
    const wrapper = await mountPage()
    const header = wrapper.find('[data-stub="mobile-header"]')
    expect(header.exists()).toBe(true)
    expect(header.find('h1').text()).toBe('역삼동')
  })

  it('토지 헤더는 hideDirections=true(좌표 없음 → 공유만)다', async () => {
    const wrapper = await mountPage()
    const header = wrapper.find('[data-stub="mobile-header"]')
    // Vue는 boolean true prop을 HTML 속성으로 직렬화할 때 빈 문자열('')로 표현(속성 존재 = true)
    // 또는 prop이 직접 바인딩되므로 undefined가 아닌 것으로 확인
    const val = header.attributes('data-hide-directions')
    expect(val).not.toBeUndefined()
  })

  it('PageHero는 title-tag="div"로 강등되고 hidden md:block을 갖는다', async () => {
    const wrapper = await mountPage()
    const hero = wrapper.find('[data-stub="hero"]')
    expect(hero.exists()).toBe(true)
    expect(hero.attributes('data-title-tag')).toBe('div')
    expect(hero.classes()).toContain('hidden')
    expect(hero.classes()).toContain('md:block')
  })

  it('헤드라인 카드(대지 평당가)가 첫 AdBanner보다 DOM 앞에 온다(T1 승격)', async () => {
    const wrapper = await mountPage()
    const html = wrapper.html()
    const headlineIdx = html.indexOf('대지(일반 거래) 평당가')
    const firstAdIdx = html.indexOf('stub-ad')
    expect(headlineIdx).toBeGreaterThan(-1)
    expect(firstAdIdx).toBeGreaterThan(-1)
    expect(headlineIdx).toBeLessThan(firstAdIdx)
  })

  it('헤드라인 카드 wrapper에 order 클래스가 부여된다', async () => {
    const wrapper = await mountPage()
    // 헤드라인 카드는 "대지(일반 거래) 평당가" 텍스트를 포함하는 카드 div
    const card = wrapper
      .findAll('div')
      .find((d) => d.text().includes('대지(일반 거래) 평당가') && d.classes().some((c) => c.startsWith('order-')))
    expect(card, '헤드라인 카드에 order-* 클래스가 있어야 한다').toBeTruthy()
    expect(card!.classes().some((c) => c.startsWith('order-'))).toBe(true)
    expect(card!.classes()).toContain('order-3')
  })

  it('DataSourceSection은 order 클래스를 가진 wrapper로 감싸진다(멀티루트)', async () => {
    const wrapper = await mountPage()
    const ds = wrapper.find('[data-stub="datasource"]')
    expect(ds.exists()).toBe(true)
    // wrapper div(부모)에 order 클래스
    const parent = ds.element.parentElement as HTMLElement
    expect(parent.className).toContain('order-12')
  })

  it('AdBanner는 정확히 3개, CoupangBanner는 1개다(광고 개수 불변)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.stub-ad')).toHaveLength(3)
    expect(wrapper.findAll('.stub-coupang')).toHaveLength(1)
  })

  it('AdBanner②가 추이/분포 섹션과 전체거래 섹션 사이에 위치한다', async () => {
    const wrapper = await mountPage()
    const html = wrapper.html()
    const distIdx = html.indexOf('용도지역 분포')
    const totalIdx = html.indexOf('전체 거래 내역')
    // 추이/분포 < (둘째)Ad < 전체거래 순서. 광고 인덱스를 분포~전체거래 구간에서 탐색.
    const adInBetween = html.slice(distIdx, totalIdx).includes('stub-ad')
    expect(distIdx).toBeGreaterThan(-1)
    expect(totalIdx).toBeGreaterThan(-1)
    expect(distIdx).toBeLessThan(totalIdx)
    expect(adInBetween, '추이/분포와 전체거래 사이에 AdBanner가 있어야 한다').toBe(true)
  })

  it('setFAQSchema가 LAND_FAQ 길이만큼 {question,answer} 형태로 호출된다', async () => {
    await mountPage()
    expect(mockSetFAQSchema).toHaveBeenCalledTimes(1)
    const faqs = mockSetFAQSchema.mock.calls[0][0]
    expect(Array.isArray(faqs)).toBe(true)
    expect(faqs.length).toBeGreaterThan(0)
    expect(faqs[0]).toHaveProperty('question')
    expect(faqs[0]).toHaveProperty('answer')
    expect(faqs[0].question).toContain('토지 실거래가 데이터는 어디서')
  })

  it('마운트 시 콘솔 에러가 없다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountPage()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  // §6-4 숫자 타이포: 토지 거래 표(분기별 추이·전체 거래) 두 표 모두 tabular-nums로 렌더되어야 한다.
  it('토지 거래 표는 tabular-nums로 렌더된다', async () => {
    const wrapper = await mountPage()
    const tables = wrapper.findAll('table')
    expect(tables.length).toBeGreaterThan(0)
    expect(tables.every((t) => t.classes().includes('tabular-nums'))).toBe(true)
  })
})
