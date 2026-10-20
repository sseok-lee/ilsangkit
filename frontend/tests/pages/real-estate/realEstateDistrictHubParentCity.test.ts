// 구가 있는 부모 시(예: 안산시)는 부동산 데이터가 구 단위로만 있어 빈 페이지가 된다.
// 지역 slug 표와 URL 헬퍼는 mock 하지 않고 실제 목록으로 구 링크를 검증한다.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// Stub Vue auto-imports
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// Mock createError (Nuxt global)
;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

// Mock useRoute with valid params
const routeParams = { realEstateType: 'apt-sale', city: 'gyeonggi', district: 'ansan' }
;(globalThis as any).useRoute = vi.fn(() => ({ params: routeParams, query: {} }))

// Mock useRouter
;(globalThis as any).useRouter = vi.fn(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
}))

const mockGetComplexList = vi.fn().mockResolvedValue({
  items: [],
  total: 0,
  page: 1,
  totalPages: 0,
})

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getComplexList: mockGetComplexList,
  }),
}))

// 전국 등록 단지 수(fail-open) — 테스트별로 mockNationalTotal.value 를 제어한다.
const mockNationalTotal = ref<number | null>(0)
vi.mock('~/composables/useNationalComplexCount', () => ({
  useNationalComplexCount: () => ({ total: mockNationalTotal }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/utils/realEstateBuildingName', () => ({
  isValidBuildingName: vi.fn(() => true),
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetItemListSchema.mockClear()
  mockGetComplexList.mockClear()
  mockGetComplexList.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 })
  mockNationalTotal.value = 0
  ;(globalThis as any).useHead.mockClear()
  ;(globalThis as any).useAsyncData = vi.fn(() => {
    const result = {
      data: ref(null),
      status: ref('idle'),
      error: ref(null),
      refresh: vi.fn(),
      pending: ref(false),
    }
    return Object.assign(Promise.resolve(result), result)
  })
})

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          PageHead: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot name="breadcrumb" /><slot /></header>' },
          SectionBlock: { props: ['heading', 'subtext', 'variant'], template: '<section><h2 v-if="heading">{{ heading }}</h2><p v-if="subtext" data-stub="subtext">{{ subtext }}</p><slot /><slot name="heading" /><slot name="right" /></section>' },
          AdBanner: { template: '<div />' },
          Pagination: { template: '<div />' },
          DataSourceSection: { template: '<div />' },
          ExplorationFilters: { template: '<div data-stub="filters" />' },
          ExplorationBuildingRow: { template: '<div data-stub="building-row" />' },
        },
        ...options?.global,
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('부모 시 빈 페이지 — 구 링크 안내', () => {
  beforeEach(() => {
    routeParams.city = 'gyeonggi'
    routeParams.district = 'ansan'
  })

  it('안산시 빈 페이지는 구별 안내 제목과 각 구 링크를 보여준다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const text = wrapper.text()
    expect(text).toContain('안산시는 구별로 나눠 보여드립니다')
    expect(text).not.toContain('이 지역에는 아직 공개 가능한 단지가 없습니다')
    const hrefs = wrapper.findAll('[data-testid="parent-city-district-links"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/real-estate/apt-sale/gyeonggi/ansan-sangnok',
      '/real-estate/apt-sale/gyeonggi/ansan-danwon',
    ])
  })

  it('부모 시 빈 페이지는 noindex(robots) 를 유지하고 지역 허브 링크를 남긴다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const useHeadMock = (globalThis as any).useHead as { mock: { calls: unknown[][] } }
    const robotsCalls = useHeadMock.mock.calls.filter(([arg]) =>
      Array.isArray((arg as any)?.meta) && (arg as any).meta.some((meta: any) => meta.name === 'robots'),
    )
    expect(robotsCalls.length).toBeGreaterThan(0)
    const hub = wrapper.findAll('a').find((a) => a.text() === '지역 허브로')
    expect(hub?.attributes('href')).toBe('/gyeonggi/ansan')
  })

  it('화성시는 부동산 전용 4개 구로 안내한다', async () => {
    routeParams.district = 'hwaseong'
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const hrefs = wrapper.findAll('[data-testid="parent-city-district-links"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/real-estate/apt-sale/gyeonggi/hwaseong-dongtan',
      '/real-estate/apt-sale/gyeonggi/hwaseong-manse',
      '/real-estate/apt-sale/gyeonggi/hwaseong-byeongjeom',
      '/real-estate/apt-sale/gyeonggi/hwaseong-hyohaeng',
    ])
  })

  it('부천시는 부동산 전용 구 목록(소사·오정·원미)으로 안내한다', async () => {
    routeParams.district = 'bucheon'
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(m.default)
    const hrefs = wrapper.findAll('[data-testid="parent-city-district-links"] a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual([
      '/real-estate/apt-sale/gyeonggi/bucheon-sosa',
      '/real-estate/apt-sale/gyeonggi/bucheon-ojeong',
      '/real-estate/apt-sale/gyeonggi/bucheon-wonmi',
    ])
  })

  it('구가 없는 지역(광명시)은 기존 빈 상태 그대로다', async () => {
    routeParams.district = 'gwangmyeong'
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/index.vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.text()).toContain('이 지역에는 아직 공개 가능한 단지가 없습니다')
    expect(wrapper.find('[data-testid="parent-city-district-links"]').exists()).toBe(false)
  })
})
