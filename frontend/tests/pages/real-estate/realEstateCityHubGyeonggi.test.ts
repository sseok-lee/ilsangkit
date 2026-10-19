import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, Suspense, h, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// 경기 시 허브 — 부동산은 구 단위로 저장되므로 REAL_ESTATE_REGIONS(부천·화성 구 분할)를 쓴다.
// shared/regionSlugs 는 mock 하지 않고 실제 목록으로 검증한다.

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
  params: { realEstateType: 'apt-sale', city: 'gyeonggi' },
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetItemListSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: mockSetItemListSchema,
  }),
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
  SectionBlock: {
    props: ['heading', 'subtext'],
    template: '<section><h2 v-if="heading">{{ heading }}</h2><p v-if="subtext">{{ subtext }}</p><slot /><slot name="heading" /></section>',
  },
  AdBanner: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
  ExplorationFilters: { template: '<div data-stub="filters" />' },
  ExplorationBuildingRow: { template: '<div data-stub="building-row" />' },
}

describe('real-estate/[realEstateType]/[city]/index.vue — 경기 구 단위 목록', () => {
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

  it('부천시·화성시는 구 링크로 나오고 시 단위 링크는 없다', async () => {
    const wrapper = await mountPage()
    const links = wrapper.findAll('a[href^="/real-estate/apt-sale/gyeonggi/"]')
    const hrefs = links.map((a) => a.attributes('href'))
    expect(hrefs).toEqual(expect.arrayContaining([
      '/real-estate/apt-sale/gyeonggi/bucheon-sosa',
      '/real-estate/apt-sale/gyeonggi/bucheon-ojeong',
      '/real-estate/apt-sale/gyeonggi/bucheon-wonmi',
      '/real-estate/apt-sale/gyeonggi/hwaseong-dongtan',
      '/real-estate/apt-sale/gyeonggi/hwaseong-hyohaeng',
    ]))
    expect(hrefs).not.toContain('/real-estate/apt-sale/gyeonggi/bucheon')
    expect(hrefs).not.toContain('/real-estate/apt-sale/gyeonggi/hwaseong')
    const names = links.map((a) => a.text())
    expect(names).toContain('부천시 소사구')
    expect(names).not.toContain('부천시')
  })
})
