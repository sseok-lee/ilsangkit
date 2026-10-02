import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref, Suspense, watch, watchEffect } from 'vue'
import { handlePropertyFixture } from '../fixtures/seo/remaining-property-data.mjs'
import { useAdsPolicy } from '~/composables/useAdsPolicy'

const route = reactive({ params: { city: 'seoul', district: 'gangnam', dong: '역삼동' }, query: {} as Record<string, string> })
const heads: Array<() => any> = []
let fail = false
let empty = false
vi.mock('~/composables/useStructuredData', () => ({ useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setFAQSchema: vi.fn(), setDetailProvenance: vi.fn() }) }))
const section = defineComponent({ setup: (_, { slots }) => () => h('section', [slots.heading?.(), slots.default?.(), slots.right?.()]) })
const ad = defineComponent({ setup() { const { shouldServeAds } = useAdsPolicy(); return () => shouldServeAds.value ? h('div', { 'data-ad': true }) : null } })
const stubs = { AdBanner: ad, SectionBlock: section, PageHero: true, PageHead: true, Breadcrumb: true, MobileDetailHeader: true, DataSourceSection: true, AuctionFilters: true, AuctionRankingTable: true, AuctionCard: true, Pagination: true, EmptyState: true }

beforeEach(() => {
  fail = false; empty = false; heads.length = 0; route.query = {}
  ;(globalThis as any).__resetUseState()
  Object.assign(globalThis, { computed, ref, watch, watchEffect,
    useRoute: () => route, useRouter: () => ({ push: ({ query }: { query: Record<string, string> }) => { route.query = query } }),
    useHead: (arg: any) => heads.push(typeof arg === 'function' ? arg : () => arg),
    $fetch: vi.fn(async (url: string) => {
      if (fail) throw new Error('503')
      const result = handlePropertyFixture(new URL(url, 'http://localhost'))
      if (!result || result.status !== 200) throw new Error('fixture path')
      const body = structuredClone(result.body)
      if (empty && url.includes('/ranking')) body.data = []
      if (empty && url.includes('/items')) { body.data.items = []; body.data.total = 0 }
      return body
    }),
    useAsyncData: async (_key: unknown, fetcher: () => unknown, options?: { default?: () => unknown }) => {
      const data = ref(options?.default?.() ?? null); const error = ref<unknown>(null); const pending = ref(false)
      const refresh = async () => { pending.value = true; try { data.value = await fetcher(); error.value = null } catch (e) { error.value = e } finally { pending.value = false } }
      await refresh()
      return { data, error, pending, status: ref(error.value ? 'error' : 'success'), refresh }
    },
  })
})
let components: Record<string, any>
beforeAll(async () => {
  components = {
    land: (await import('~/pages/real-estate/land/[city]/[district]/[dong].vue')).default,
    list: (await import('~/pages/auction/list.vue')).default,
    ranking: (await import('~/pages/auction/ranking.vue')).default,
  }
}, 30_000)
async function page(kind: string) {
  const component = components[kind]
  const wrapper = mount(defineComponent({ render: () => h(Suspense, null, { default: () => h(component) }) }), { global: { stubs } })
  await flushPromises(); return wrapper
}
function currentHead() { return heads.map(fn => fn()).findLast(value => value.title && value.meta) }

describe('mounted property head and real ad policy', () => {
  it.each([['land', 3], ['list', 1], ['ranking', 1]] as const)('%s preserves slots, suppresses query, restores clean URL', async (kind, slots) => {
    const wrapper = await page(kind)
    expect(wrapper.findAll('[data-ad]')).toHaveLength(slots)
    expect(currentHead().link.some((link: any) => link.rel === 'canonical')).toBe(true)
    route.query = { q: '강남' }; await flushPromises()
    expect(wrapper.findAll('[data-ad]')).toHaveLength(0)
    expect(currentHead().meta.find((meta: any) => meta.name === 'robots')?.content).toBe('noindex, follow')
    expect(currentHead().link).toEqual([])
    route.query = {}; await flushPromises()
    expect(wrapper.findAll('[data-ad]')).toHaveLength(slots)
    expect(currentHead().link).toHaveLength(1)
    wrapper.unmount()
  })
  it.each(['list', 'ranking'])('%s suppresses advertisements on actual zero and fetch error', async kind => {
    empty = true; const zero = await page(kind); expect(zero.findAll('[data-ad]')).toHaveLength(0); zero.unmount()
    empty = false; fail = true; const failure = await page(kind)
    expect(failure.findAll('[data-ad]')).toHaveLength(0)
    expect(failure.find('[role="alert"]').exists()).toBe(true)
    failure.unmount()
  })
})


it('land failure suppresses all existing ad slots and preserves an explicit retry', async () => {
  fail = true
  const wrapper = await page('land')
  expect(wrapper.findAll('[data-ad]')).toHaveLength(0)
  expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  wrapper.unmount()
})

it('land filters belong only to transactions while the regional summary stays unfiltered', async () => {
  const clean = await page('land')
  const summaryText = clean.find('.property-stat').text()
  clean.unmount()
  vi.mocked(globalThis.$fetch).mockClear()
  route.query = { q: '검증', jimok: '대', landUse: '제2종일반주거지역', page: '2' }
  const filtered = await page('land')
  const calls = vi.mocked(globalThis.$fetch).mock.calls.map(([url]) => new URL(String(url), 'http://localhost'))
  const transactions = calls.find(url => url.pathname.endsWith('/transactions'))!
  expect(transactions).toBeDefined()
  expect(Object.fromEntries(transactions.searchParams)).toMatchObject({ keyword: '검증', jimok: '대', landUse: '제2종일반주거지역', page: '2' })
  const region = calls.find(url => url.pathname.endsWith('/region'))!
  expect(region).toBeDefined()
  for (const key of ['keyword', 'jimok', 'landUse']) expect(region.searchParams.has(key)).toBe(false)
  expect(region.searchParams.get('page')).toBe('1')
  expect(filtered.find('.property-stat').text()).toBe(summaryText)
  expect(filtered.findAll('tbody').at(0)?.findAll('tr')).toHaveLength(5)
  filtered.unmount()
})
