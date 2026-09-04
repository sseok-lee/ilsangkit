import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

/**
 * /auction/ranking 소프트 404 회귀 가드.
 *
 * 2026-09-04 프로덕션 실측: 낙찰 데이터 0건인데 HTTP 200 + index,follow + self-canonical 로
 * 나가고 본문은 "낙찰 데이터가 없습니다" 한 줄이었다(네이버 소프트 404 25건 중 하나).
 * 동시에 페이지가 fetcher 안에서 `catch { return [] }` 로 실패를 삼켜, 백엔드 장애와
 * "아직 데이터 없음"이 구분되지 않았다 — 장애 한 번이 정상 페이지를 noindex 로 만든다.
 */

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

;(globalThis as any).useRoute = vi.fn(() => ({ params: {}, query: {} }))
;(globalThis as any).useRequestEvent = vi.fn(() => null)
;(globalThis as any).setResponseStatus = vi.fn()
;(globalThis as any).useResponseHeader = vi.fn(() => ({ value: '' }))

// useAsyncData: 실제 fetcher 를 돌리고, reject 는 error ref 로 올린다(페이지가 그 error 를 읽는다).
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

const mockGetRanking = vi.fn(async (_params: any) => [] as any[])

vi.mock('~/composables/useAuction', () => ({
  useAuction: () => ({ getRanking: mockGetRanking }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setFAQSchema: vi.fn(),
    setDetailProvenance: vi.fn(),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og-image.png',
}))

const rankingRow = {
  city: '서울',
  district: '강남구',
  bjdCode: '1168000000',
  dongName: null,
  avgBidRate: 87.4,
  winCount: 12,
  activeCount: 5,
  isIndexable: true,
}

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AuctionRankingTable: { template: '<table data-stub="ranking-table" />', props: ['rows'] },
  EmptyState: { template: '<div data-stub="empty"><slot /></div>', props: ['icon', 'title', 'description'] },
  AdBanner: { template: '<div class="stub-ad" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}

async function mountPage() {
  const m = await import('~/pages/auction/ranking.vue')
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

/** useHead 는 객체 또는 객체를 반환하는 함수로 호출될 수 있다. */
function resolveHead(arg: any): any {
  return typeof arg === 'function' ? arg() : arg
}

function headOf(): { meta: Array<Record<string, string>>; link: Array<Record<string, string>> } {
  const head = resolveHead(capturedHeadCalls[capturedHeadCalls.length - 1])
  return { meta: head.meta ?? [], link: head.link ?? [] }
}

beforeEach(() => {
  capturedHeadCalls.length = 0
  mockGetRanking.mockReset()
  mockGetRanking.mockImplementation(async (_params: any) => [])
})

describe('pages/auction/ranking.vue — 색인 판정', () => {
  it('[행 0건] robots noindex, follow 를 내보낸다(소프트 404 차단)', async () => {
    await mountPage()
    const { meta } = headOf()
    const robots = meta.find((m) => m.name === 'robots')
    expect(robots).toBeDefined()
    expect(robots!.content).toBe('noindex, follow')
  })

  it('[행 0건] canonical 을 함께 내보내지 않는다(noindex-canonical-policy)', async () => {
    await mountPage()
    const { link } = headOf()
    expect(link.find((l) => l.rel === 'canonical')).toBeUndefined()
  })

  it('[행 있음] robots noindex 가 없고 self-canonical 이 붙는다(데이터가 생기면 자동 복귀)', async () => {
    mockGetRanking.mockImplementation(async (_params: any) => [rankingRow])
    await mountPage()
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    const canonical = link.find((l) => l.rel === 'canonical')
    expect(canonical).toBeDefined()
    expect(canonical!.href).toBe('https://ilsangkit.co.kr/auction/ranking')
  })

  it('[fetch 실패] 색인 상태를 건드리지 않는다(fail-open — 장애가 de-index 를 만들지 않는다)', async () => {
    mockGetRanking.mockImplementation(async (_params: any) => {
      throw new Error('backend 503')
    })
    await mountPage()
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    expect(link.find((l) => l.rel === 'canonical')).toBeDefined()
  })

  it('[fetch 실패] 본문은 그대로 렌더된다(throw 하지 않는다)', async () => {
    mockGetRanking.mockImplementation(async (_params: any) => {
      throw new Error('backend 503')
    })
    const wrapper = await mountPage()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('[data-stub="empty"]').exists()).toBe(true)
  })

  it('og:image 는 색인 여부와 무관하게 유지된다(소셜 공유 신호)', async () => {
    await mountPage()
    const { meta } = headOf()
    const ogImage = meta.find((m) => m.property === 'og:image')
    expect(ogImage).toBeDefined()
    expect(ogImage!.content).toMatch(/\.png$/)
  })

  it('useHead 는 함수형으로 호출된다(robots/canonical 이 데이터에 반응해야 한다)', async () => {
    await mountPage()
    expect(capturedHeadCalls.length).toBeGreaterThan(0)
    expect(typeof capturedHeadCalls[capturedHeadCalls.length - 1]).toBe('function')
  })
})
