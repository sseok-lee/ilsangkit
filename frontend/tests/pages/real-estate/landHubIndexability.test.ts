import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

/**
 * 토지 시/도·구/군 허브의 색인 판정 회귀 가드.
 *
 * 두 허브는 렌더할 동/구가 0개여도 조건 없이 index + self-canonical 로 나갔다.
 * 그 상태의 본문은 "…거래 데이터가 준비 중입니다" 한 줄 + 푸터 보일러플레이트뿐이라
 * 소프트 404 이고, 형제 허브들과 title/description 이 거의 같아 중복 문서로도 잡힌다.
 *
 * 동시에 일시 장애(degraded)는 절대 noindex 로 굳히면 안 된다 — 503 과 noindex 를
 * 함께 내보내는 것이 이 프로젝트가 반복해서 겪은 색인 붕괴 경로다(#467).
 */

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

;(globalThis as any).useRequestEvent = vi.fn(() => null)
;(globalThis as any).setResponseStatus = vi.fn()
;(globalThis as any).useResponseHeader = vi.fn(() => ({ value: '' }))

;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => unknown, options?: any) => {
  const fallback = () => (options?.default ? options.default() : null)
  let value: unknown = fallback()
  let failure: unknown = null
  try {
    value = await fetcher()
  } catch (e) {
    failure = e
    value = fallback()
  }
  const payload = {
    data: ref(value),
    error: ref(failure),
    status: ref(failure ? 'error' : 'success'),
    refresh: vi.fn(),
    pending: ref(false),
  }
  return Object.assign(Promise.resolve(payload), payload)
})

const capturedHeadCalls: any[] = []
;(globalThis as any).useHead = vi.fn((argOrFn: any) => {
  capturedHeadCalls.push(argOrFn)
})

const mockSetMeta = vi.fn()
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: mockSetMeta }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울', busan: '부산' },
  DISTRICT_SLUG_MAP: { 강남구: 'gangnam', 서초구: 'seocho' },
  REGIONS: { 서울: ['강남구', '서초구'] },
  CITY_FULL_NAME_TO_SLUG: {},
  CITY_SLUGS: { 서울: 'seoul', 부산: 'busan' },
  getDistrictSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}))

const dong = {
  bjdCode: '1168010100',
  dongName: '역삼1동',
  city: '서울',
  district: '강남구',
  transactionCount: 30,
  recentCount: 10,
  avgPricePerPyeong: 6000,
  latestDealDate: '2026-05-01',
  isIndexable: true,
  jimokBreakdown: { 대: 25 },
  daeCount: 25,
}

/** 'items' = 정상 목록, 'empty' = 성공했는데 0건, 'fail' = fetch 실패 */
let regionsMode: 'items' | 'empty' | 'fail' = 'items'

vi.mock('~/composables/useLand', () => ({
  useLand: () => ({
    getRegions: async (_params: any) => {
      if (regionsMode === 'fail') throw new Error('backend 503')
      return {
        items: regionsMode === 'items' ? [dong] : [],
        total: regionsMode === 'items' ? 1 : 0,
        page: 1,
        totalPages: 1,
      }
    },
    getHubSummary: async () => ({ cities: [], totalTransactions: 0 }),
    getRegionDetail: async () => ({
      items: [], total: 0, page: 1, totalPages: 1, jimokGroups: [], daeSamples: [],
      daeNonShareCount: 0, landUseDistribution: [], priceTimeline: [], daeCount: 0,
    }),
  }),
}))

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div class="stub-ad" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}

async function mountHub(kind: 'city' | 'district', mode: 'items' | 'empty' | 'fail') {
  regionsMode = mode
  mockSetMeta.mockClear()
  capturedHeadCalls.length = 0
  ;(globalThis as any).useRoute = vi.fn(() =>
    kind === 'city' ? { params: { city: 'seoul' } } : { params: { city: 'seoul', district: 'gangnam' } },
  )
  const m =
    kind === 'city'
      ? await import('~/pages/real-estate/land/[city]/index.vue')
      : await import('~/pages/real-estate/land/[city]/[district]/index.vue')
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

/** setMeta 인자에서 canonical 옵션을 꺼낸다(false = canonical 태그 미삽입). */
function canonicalOption(): unknown {
  return mockSetMeta.mock.calls[0]?.[0]?.canonical
}

/** useHead 로 들어온 robots meta 를 찾는다. */
function robotsContent(): string | undefined {
  for (const arg of capturedHeadCalls) {
    const head = typeof arg === 'function' ? arg() : arg
    const found = (head?.meta ?? []).find((m: Record<string, string>) => m.name === 'robots')
    if (found) return found.content
  }
  return undefined
}

beforeEach(() => {
  mockSetMeta.mockClear()
  capturedHeadCalls.length = 0
})

describe.each([
  ['district', '구·군 허브'],
  ['city', '시/도 허브'],
] as const)('토지 %s 색인 판정', (kind, _label) => {
  it('[항목 있음] robots noindex 없이 canonical 을 유지한다', async () => {
    await mountHub(kind, 'items')
    expect(robotsContent()).toBeUndefined()
    expect(canonicalOption()).toBeUndefined()
  })

  it('[항목 0개] noindex, follow 를 내보낸다(소프트 404 차단)', async () => {
    await mountHub(kind, 'empty')
    expect(robotsContent()).toBe('noindex, follow')
  })

  it('[항목 0개] canonical 을 함께 내보내지 않는다(noindex-canonical-policy)', async () => {
    await mountHub(kind, 'empty')
    expect(canonicalOption()).toBe(false)
  })

  it('[fetch 실패] 색인 상태를 건드리지 않는다(fail-open)', async () => {
    await mountHub(kind, 'fail')
    expect(robotsContent()).toBeUndefined()
    expect(canonicalOption()).toBeUndefined()
  })
})
