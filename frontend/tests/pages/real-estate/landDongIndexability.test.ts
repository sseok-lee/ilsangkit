import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

/**
 * 토지 동상세 색인 판정 회귀 가드 (utils/indexability.ts 적용).
 *
 * 두 결함을 동시에 잡는다.
 * 1) 과잉 제외 — sync 시점 스냅샷(LandRegionSummary.isIndexable = 최근 12개월 5건 이상
 *    또는 누적 10건 이상)은 "총 5건 중 최근 3건"인 동을 noindex 로 만들었다.
 *    그 동도 지목별 시세 그리드와 대지 거래 사례 카드를 전부 렌더한다.
 * 2) fail-open 위반 — landError 가 있으면 data 가 null 이라 옵셔널 체이닝이 undefined 로
 *    떨어져 noindex 가 켜졌고, 503 과 'noindex, follow' 가 한 응답에 같이 실렸다.
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

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { city: 'seoul', district: 'gangnam', dong: '%EC%97%AD%EC%82%BC%EB%8F%99' },
}))

;(globalThis as any).useRequestEvent = vi.fn(() => null)
;(globalThis as any).setResponseStatus = vi.fn()
;(globalThis as any).useResponseHeader = vi.fn(() => ({ value: '' }))

// 실패를 error ref 로 올리는 useAsyncData — 페이지가 그 error 로 fail-open 을 판정한다.
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

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setFAQSchema: vi.fn(),
    setDetailProvenance: vi.fn(),
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

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og-image.png',
  compactCityName: (city: string) => (city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, ''),
}))

/**
 * summary 를 구성한다.
 * isIndexable 은 일부러 요청 시점 정책과 어긋나게 넣어 스냅샷 의존이 끊겼는지 확인한다.
 */
function summaryOf(transactionCount: number, snapshotIndexable: boolean) {
  return {
    bjdCode: '1168010100',
    dongName: '역삼동',
    city: '서울',
    district: '강남구',
    transactionCount,
    recentCount: 3,
    avgPricePerPyeong: 8000,
    latestDealDate: '2026-05-15',
    isIndexable: snapshotIndexable,
    jimokBreakdown: { 대: transactionCount },
    daeCount: transactionCount,
    daeNonShareCount: transactionCount,
  }
}

const emptyDetail = {
  items: [], total: 0, page: 1, totalPages: 0,
  jimokGroups: [], daeSamples: [], daeNonShareCount: 0,
  landUseDistribution: [], priceTimeline: [], daeCount: 0,
}

let regionsImpl: () => Promise<any> = async () => ({ items: [summaryOf(120, true)], total: 1, page: 1, totalPages: 1 })

vi.mock('~/composables/useLand', () => ({
  useLand: () => ({
    getRegions: () => regionsImpl(),
    getRegionDetail: async () => emptyDetail,
    getTransactions: async () => ({ items: [], total: 0, page: 1, totalPages: 0 }),
    getHubSummary: async () => ({ cities: [], totalTransactions: 0 }),
  }),
}))

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />', props: ['titleTag'] },
  MobileDetailHeader: {
    template: '<section data-stub="mobile-header"><h1>{{ title }}</h1></section>',
    props: ['title', 'eyebrow', 'stats', 'hideDirections'],
  },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  Pagination: { template: '<div data-stub="pagination" />' },
  AdBanner: { template: '<div class="stub-ad" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}

async function mountPage() {
  capturedHeadCalls.length = 0
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

function headOf(): { meta: Array<Record<string, string>>; link: Array<Record<string, string>> } {
  const arg = capturedHeadCalls.find((a) => typeof a === 'function')
  const head = typeof arg === 'function' ? arg() : arg
  return { meta: head?.meta ?? [], link: head?.link ?? [] }
}

beforeEach(() => {
  capturedHeadCalls.length = 0
  regionsImpl = async () => ({ items: [summaryOf(120, true)], total: 1, page: 1, totalPages: 1 })
})

describe('pages/real-estate/land/[city]/[district]/[dong].vue — 요청 시점 색인 판정', () => {
  it('[거래 5건] sync 스냅샷이 false 여도 색인 대상이다(과잉 제외 회복)', async () => {
    // 최근 12개월 3건 / 누적 5건 → 스냅샷 정책은 두 조건 모두 미달이라 false 였다.
    regionsImpl = async () => ({ items: [summaryOf(5, false)], total: 1, page: 1, totalPages: 1 })
    await mountPage()
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    expect(link.find((l) => l.rel === 'canonical')).toBeDefined()
  })

  it('[거래 3건] 임계값 정확히 = 색인 대상이다', async () => {
    regionsImpl = async () => ({ items: [summaryOf(3, false)], total: 1, page: 1, totalPages: 1 })
    await mountPage()
    expect(headOf().meta.find((m) => m.name === 'robots')).toBeUndefined()
  })

  it('[거래 2건] 임계 미만 = noindex, follow + canonical 생략', async () => {
    // 스냅샷이 true 여도 실제 콘텐츠가 얇으면 색인하지 않는다(판정 소스는 요청 시점 데이터).
    regionsImpl = async () => ({ items: [summaryOf(2, true)], total: 1, page: 1, totalPages: 1 })
    await mountPage()
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')!.content).toBe('noindex, follow')
    expect(link.find((l) => l.rel === 'canonical')).toBeUndefined()
  })

  it('[fetch 실패] 503 과 noindex 를 함께 내보내지 않는다(fail-open)', async () => {
    regionsImpl = async () => {
      throw new Error('backend 503')
    }
    await mountPage()
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    expect(link.find((l) => l.rel === 'canonical')).toBeDefined()
  })

  it('[fetch 실패] 404 로 굳히지 않고 본문을 렌더한다', async () => {
    regionsImpl = async () => {
      throw new Error('backend 503')
    }
    const wrapper = await mountPage()
    expect(wrapper.find('[data-stub="mobile-header"]').exists()).toBe(true)
  })
})
