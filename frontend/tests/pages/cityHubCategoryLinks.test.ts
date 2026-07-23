import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, onMounted } from 'vue'
import CityHub from '~/pages/[city]/index.vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).onMounted = onMounted

// createError: seoul은 CITY_SLUG_MAP에 있으므로 실제로 throw 되지 않음 — 객체 반환만
;(globalThis as any).createError = vi.fn((opts: unknown) => opts)

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setAreaReportSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackRegionPageView: vi.fn() }),
}))

let nationalStatsTotal: number | null = 4500000
vi.mock('~/composables/useNationalStats', () => ({
  useNationalStats: () => ({ stats: ref(nationalStatsTotal === null ? null : { total: nationalStatsTotal }) }),
}))

// Override the global useRoute stub (set in setup.ts) to provide city param
;(globalThis as any).useRoute = () => ({ params: { city: 'seoul' }, query: {}, fullPath: '/seoul', path: '/seoul', name: 'city', hash: '', matched: [], meta: {}, redirectedFrom: undefined })

vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
  const data = ref<any>({
    data: {
      districts: [{ slug: 'gangnam-gu', name: '강남구', facilityTotal: 100 }],
      realEstate: null,
    },
  })
  return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
    data,
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  })
})

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: true,
  PageHero: {
    props: ['stats'],
    template: '<div data-stub="hero"><span v-for="s in (stats||[])" :key="s.label" class="hero-stat" :data-label="s.label">{{ s.value }}</span></div>',
  },
  AdBanner: true,
  RegionRealEstatePrices: true,
  RegionRealEstateCta: true,
  RecentGuides: true,
  DataSourceSection: true,
  ClientOnly: { template: '<div><slot /></div>' },
}

async function mountSuspended() {
  const w = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(CityHub) }) } }),
    { global: { stubs } },
  )
  await flushPromises()
  return w
}

describe('지역 허브 카테고리 바로가기', () => {
  it('각 카테고리를 /{cat}?city={slug} 링크로 렌더한다', async () => {
    const w = await mountSuspended()
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/pharmacy?city=seoul')
    expect(hrefs).toContain('/hospital?city=seoul')
    expect(hrefs).toContain('/parking?city=seoul')
  })
})

describe('city hub — noindex guard (Issue E)', () => {
  it('데이터가 null이면 useHead에 noindex 메타가 포함되어야 한다', async () => {
    // null 데이터 반환으로 재스텁
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>(null)
      return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
        data,
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      })
    })

    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy

    // 모듈 캐시 제거 후 재임포트
    vi.resetModules()
    const { default: CityHubFresh } = await import('~/pages/[city]/index.vue')

    const w = mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(CityHubFresh) }) } }),
      { global: { stubs } },
    )
    await flushPromises()

    // useHead 호출 중 noindex 신호가 있어야 함
    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]
      return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')),
    )
    expect(hasNoindex).toBe(true)

    // 복원
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>({
        data: {
          districts: [{ slug: 'gangnam-gu', name: '강남구', facilityTotal: 100 }],
          realEstate: null,
        },
      })
      return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
        data,
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      })
    })
    ;(globalThis as any).useHead = vi.fn()
  })

  it('데이터가 있으면 useHead에 noindex 메타가 없어야 한다', async () => {
    // 정상 데이터 stub (이미 파일 상단에서 설정돼 있지만 null 테스트 이후 복원된 상태)
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>({
        data: {
          districts: [{ slug: 'gangnam-gu', name: '강남구', facilityTotal: 100 }],
          realEstate: null,
        },
      })
      return Object.assign(Promise.resolve({ data, pending: ref(false), error: ref(null), refresh: vi.fn() }), {
        data,
        pending: ref(false),
        error: ref(null),
        refresh: vi.fn(),
      })
    })

    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy

    vi.resetModules()
    const { default: CityHubFresh } = await import('~/pages/[city]/index.vue')

    const w = mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(CityHubFresh) }) } }),
      { global: { stubs } },
    )
    await flushPromises()

    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]
      return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')),
    )
    expect(hasNoindex).toBe(false)

    ;(globalThis as any).useHead = vi.fn()
  })
})

// '카운터 밴드' describe 제거: 시설 목록/허브 상단 스탯 밴드(이 지역·전국 등록·데이터 갱신)를
// 사용자 요청으로 제거함에 따라 해당 밴드 테스트도 함께 삭제.
