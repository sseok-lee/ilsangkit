import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

/**
 * /auction/list?usage=<값> 파라미터 URL 증식 회귀 가드.
 *
 * 예전 isIndexable 은 파라미터 '이름'만 화이트리스트하고 '값'은 검증하지 않았다.
 * 그래서 크롤러가 지어낸 ?usage=zzz 가 200 + index,follow + self-canonical 로 나갔고,
 * 알 수 없는 값은 라벨 폴백('부동산 공매 물건') 때문에 title/description 이 바닥 목록과
 * 완전히 같았다 — 값 하나당 중복 title 문서가 하나씩 늘어나는 경로였다.
 */

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

let currentQuery: Record<string, string> = {}
;(globalThis as any).useRoute = vi.fn(() => ({ params: {}, query: currentQuery }))
;(globalThis as any).useRouter = vi.fn(() => ({ push: vi.fn() }))

;(globalThis as any).useAsyncData = vi.fn(async (_key: string, fetcher: () => unknown, options?: any) => {
  let value: unknown = options?.default ? options.default() : null
  try {
    value = await fetcher()
  } catch {
    value = options?.default ? options.default() : null
  }
  const payload = {
    data: ref(value),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(),
    pending: ref(false),
  }
  return Object.assign(Promise.resolve(payload), payload)
})

const capturedHeadCalls: any[] = []
;(globalThis as any).useHead = vi.fn((argOrFn: any) => {
  capturedHeadCalls.push(argOrFn)
})

vi.mock('~/composables/useAuction', () => ({
  useAuction: () => ({
    getItems: vi.fn(async (_params: any) => ({ items: [], total: 0, page: 1, totalPages: 0 })),
  }),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og-image.png',
}))

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AuctionFilters: { template: '<div data-stub="filters" />', props: ['usage', 'status', 'city', 'district'] },
  AuctionCard: { template: '<article data-stub="card" />', props: ['item'] },
  Pagination: { template: '<div data-stub="pagination" />', props: ['currentPage', 'totalPages'] },
  EmptyState: { template: '<div data-stub="empty"><slot /></div>', props: ['icon', 'title', 'description'] },
  AdBanner: { template: '<div class="stub-ad" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}

async function mountWithQuery(query: Record<string, string>) {
  currentQuery = query
  capturedHeadCalls.length = 0
  const m = await import('~/pages/auction/list.vue')
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

function headOf(): { title: string; meta: Array<Record<string, string>>; link: Array<Record<string, string>> } {
  const arg = capturedHeadCalls[capturedHeadCalls.length - 1]
  const head = typeof arg === 'function' ? arg() : arg
  return { title: head.title, meta: head.meta ?? [], link: head.link ?? [] }
}

beforeEach(() => {
  currentQuery = {}
  capturedHeadCalls.length = 0
})

describe('pages/auction/list.vue — ?usage= 값 검증', () => {
  it('[알 수 없는 값] noindex, follow 를 내보낸다', async () => {
    await mountWithQuery({ usage: 'zzz' })
    const { meta } = headOf()
    const robots = meta.find((m) => m.name === 'robots')
    expect(robots).toBeDefined()
    expect(robots!.content).toBe('noindex, follow')
  })

  it('[알 수 없는 값] canonical 을 함께 내보내지 않는다(noindex-canonical-policy)', async () => {
    await mountWithQuery({ usage: 'zzz' })
    const { link } = headOf()
    expect(link.find((l) => l.rel === 'canonical')).toBeUndefined()
  })

  it('[알 수 없는 값] og:url 도 그 파라미터 URL 을 대표 주소로 광고하지 않는다', async () => {
    await mountWithQuery({ usage: 'zzz' })
    const { meta } = headOf()
    const ogUrl = meta.find((m) => m.property === 'og:url')
    expect(ogUrl!.content).toBe('https://ilsangkit.co.kr/auction/list')
  })

  it('[알려진 값] 색인 대상이고 self-canonical 이 그 값으로 붙는다', async () => {
    await mountWithQuery({ usage: 'land' })
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    const canonical = link.find((l) => l.rel === 'canonical')
    expect(canonical!.href).toBe('https://ilsangkit.co.kr/auction/list?usage=land')
  })

  it('[파라미터 없음] 바닥 목록은 색인 대상이다', async () => {
    await mountWithQuery({})
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')).toBeUndefined()
    expect(link.find((l) => l.rel === 'canonical')!.href).toBe('https://ilsangkit.co.kr/auction/list')
  })

  it('[알려진 값 + 다른 필터] 임의 조합은 종전대로 색인 제외다(회귀 가드)', async () => {
    await mountWithQuery({ usage: 'land', city: '서울' })
    const { meta, link } = headOf()
    expect(meta.find((m) => m.name === 'robots')!.content).toBe('noindex, follow')
    expect(link.find((l) => l.rel === 'canonical')).toBeUndefined()
  })

  it('[알 수 없는 값] 프로토타입 키(constructor)도 알려진 용도로 오인하지 않는다', async () => {
    await mountWithQuery({ usage: 'constructor' })
    const { meta } = headOf()
    expect(meta.find((m) => m.name === 'robots')!.content).toBe('noindex, follow')
  })
})
