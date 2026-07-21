import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, Suspense, h, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// 전남광주통합특별시 suffix-strip 예외(Task A4) 검증 — shared/regionSlugs는 mock하지 않고
// 실제 CITY_SLUG_MAP/REGIONS/DISTRICT_SLUG_MAP을 사용해 페이지 로직을 통합 검증한다.

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
  params: { realEstateType: 'apt-sale', city: 'jeonnamgwangju' },
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
  ;(globalThis as any).useAsyncData = vi.fn((_k: string, _h: () => Promise<unknown>) => {
    const data = ref<any>([])
    return Object.assign(Promise.resolve({ data }), { data, pending: ref(false), error: ref(null), refresh: vi.fn() })
  })
})

const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div />' },
}

describe('real-estate/[realEstateType]/[city]/index.vue — 전남광주통합특별시 (Task A4 suffix-strip 예외)', () => {
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

  it('404를 던지지 않고 렌더링된다 (CITY_SLUG_MAP 해석 성공)', async () => {
    await expect(mountPage()).resolves.toBeDefined()
  })

  it('제목/본문에 전남광주통합특별시가 잘리지 않은 형태로 노출되지 않아야 한다 (suffix 예외로 city는 REGIONS 키로만 쓰이고, 화면 표시는 축약되지 않은 원본을 그대로 씀)', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    // suffix-strip 예외가 없다면 cityName='전남광주통합'이 되어 REGIONS 매칭 실패 → 구/군 목록이 비게 된다.
    // 예외가 정상 동작하면 27개 구/군 링크가 전부 렌더링된다.
    expect(text).toContain('전남광주통합특별시')
  })

  it('광주 5구 + 전남 22시군 링크가 전부(27개) flat 렌더링되어야 한다', async () => {
    const wrapper = await mountPage()
    const links = wrapper.findAll('a[href*="/real-estate/apt-sale/jeonnamgwangju/"]')
    expect(links).toHaveLength(27)
  })

  it('광주 5구 district 링크가 정상 slug로 렌더링된다 (동구 → dong)', async () => {
    const wrapper = await mountPage()
    const link = wrapper.find('a[href="/real-estate/apt-sale/jeonnamgwangju/dong"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('동구')
  })

  it('전남 시군 district 링크가 정상 slug로 렌더링된다 (신안군 → sinan)', async () => {
    const wrapper = await mountPage()
    const link = wrapper.find('a[href="/real-estate/apt-sale/jeonnamgwangju/sinan"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('신안군')
  })

  it('breadcrumb 마지막 항목 URL이 jeonnamgwangju slug를 포함해야 한다', async () => {
    await mountPage()
    const crumbs = mockSetBreadcrumbSchema.mock.calls[0][0]
    expect(crumbs[3].url).toContain('jeonnamgwangju')
  })

  it('setItemListSchema에 27개 구/군 항목이 전달되어야 한다', async () => {
    await mountPage()
    const items = mockSetItemListSchema.mock.calls[0][0]
    expect(items).toHaveLength(27)
  })
})
