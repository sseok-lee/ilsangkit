import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, Suspense, h, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

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
  params: { realEstateType: 'apt-sale', city: 'seoul' },
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울' },
  DISTRICT_SLUG_MAP: { '강남구': 'gangnam', '강북구': 'gangbuk' },
  REGIONS: { '서울': ['강남구', '강북구'] },
  CITY_FULL_NAME_TO_SLUG: { '서울특별시': 'seoul' },
  CITY_SLUGS: { '서울': 'seoul' },
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
  ;(globalThis as any).useAsyncData = vi.fn((key: string) => {
    const data = ref<any>(key.startsWith('re-city-map-center-')
      ? null
      : { items: [], total: 0, page: 1, totalPages: 0 })
    const result = {
      data,
      pending: ref(false),
      error: ref(null),
      status: ref('success'),
      refresh: vi.fn(),
    }
    return Object.assign(Promise.resolve(result), result)
  })
})

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: {
    props: ['title', 'description'],
    template: '<div data-stub="hero"><h1>{{ title }}</h1><p>{{ description }}</p></div>',
  },
  PageHead: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot name="breadcrumb" /><slot /></header>' },
  SectionBlock: {
    props: ['heading', 'subtext', 'variant'],
    template: '<section><h2 v-if="heading">{{ heading }}</h2><p v-if="subtext">{{ subtext }}</p><slot /><slot name="heading" /></section>',
  },
  AdBanner: { template: '<div />' },
  DataSourceSection: { template: '<div>국토교통부</div>' },
  ExplorationFilters: { template: '<div data-stub="filters" />' },
  ExplorationBuildingRow: {
    props: ['building'],
    template: '<div data-stub="building-row">{{ building.buildingName }}</div>',
  },
}

describe('real-estate/[realEstateType]/[city]/index.vue — city hub', () => {
  async function mountPage() {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/index.vue')
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

  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/index.vue')
    expect(m.default).toBeDefined()
  })

  it('구/군 링크가 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('a[href*="gangnam"]').exists()).toBe(true)
    expect(wrapper.find('a[href*="gangbuk"]').exists()).toBe(true)
  })

  it('구/군 링크 URL이 /real-estate/[type]/[city]/[district] 형식이어야 한다', async () => {
    const wrapper = await mountPage()
    const link = wrapper.find('a[href*="gangnam"]')
    expect(link.attributes('href')).toBe('/real-estate/apt-sale/seoul/gangnam')
  })

  it('setBreadcrumbSchema가 4단계로 호출되어야 한다', async () => {
    await mountPage()
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs).toHaveLength(4)
  })

  it('breadcrumb item[1]이 부동산 허브를 가리켜야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[1].name).toBe('부동산 실거래가')
    expect(crumbs[1].url).toContain('/real-estate')
  })

  it('breadcrumb item[2]가 canonical realEstateType URL을 가리켜야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[2].url).toBe('/real-estate/apt-sale')
  })

  it('breadcrumb 마지막 항목 URL이 city slug를 포함해야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[3].url).toContain('seoul')
  })

  it('setItemListSchema가 호출되어야 한다 (ItemList 구조화 데이터)', async () => {
    await mountPage()
    expect(mockSetItemListSchema).toHaveBeenCalled()
  })

  it('도시명+타입 맥락의 요약 인트로 문단을 렌더한다', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('서울')        // cityName
    expect(text).toContain('아파트')       // 타입 라벨
    expect(text).toContain('국토교통부')   // 데이터 출처 문구
  })

  it('meta title uses compact city name — no 특별시/광역시/도 suffix (Fix 4)', async () => {
    const wrapper = await mountPage()
    // CITY_SLUG_MAP['seoul'] = '서울' (compact). Rendered text must never contain full suffix.
    const text = wrapper.text()
    expect(text).not.toMatch(/특별시|특별자치시|광역시|특별자치도/)
    // Compact city name appears in rendered content
    expect(text).toContain('서울')
  })

  it('주요 건물 섹션을 ExplorationBuildingRow로 렌더한다', async () => {
    ;(globalThis as any).useAsyncData = vi.fn((key: string) => {
      const data = ref<any>(key.startsWith('re-city-map-center-')
        ? null
        : { items: [{
          buildingName: '강남타워',
          bjdCode: '11680',
          dongName: '역삼동',
          city: '서울특별시',
          district: '강남구',
          latestPrice: 120000,
          transactionCount: 12,
          lat: 37.5,
          lng: 127.0,
          lastDealYear: 2026,
          lastDealMonth: 5,
          buildYear: 2015,
        }], total: 1, page: 1, totalPages: 1 })
      const result = {
        data,
        pending: ref(false),
        error: ref(null),
        status: ref('success'),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(result), result)
    })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('주요 건물')
    expect(wrapper.text()).toContain('강남타워')
  })

  it('구/군 목록 제목을 heading prop 으로 넘기고 h1 은 하나뿐이다', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.findAll('h2').map((h) => h.text())).toContain('서울 구/군 목록')
  })

  it('구/군 카드는 그림자·떠오름 없이 테두리 카드다', async () => {
    const wrapper = await mountPage()
    const card = wrapper.findAll('a').find((a) => (a.attributes('href') ?? '').includes('gangnam'))!
    expect(card.classes()).toEqual(expect.arrayContaining(['border', 'border-line', 'rounded-[10px]', 'hover:border-primary']))
    expect(card.classes().some((c) => /shadow|translate/.test(c))).toBe(false)
  })
})
