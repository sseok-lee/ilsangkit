import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

// pages/real-estate/[realEstateType]/index.vue 는 최상위에 `await useAsyncData(...)` 를 가진
// async setup 컴포넌트라 <Suspense> 없이 mount() 하면 setup 이 끝까지 실행되지 않는다.
// 기존 tests/pages/real-estate/realEstatePropertyType.test.ts 와 동일한 Suspense 마운트 패턴을 사용한다.

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
  params: { realEstateType: 'apt-sale' },
  query: {},
}))
;(globalThis as any).useRouter = vi.fn(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}))

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getComplexList: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }),
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  SITE_TAGLINE: '생활정보 플랫폼',
  SITE_DESCRIPTION: '일상킷 - 생활정보 플랫폼',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

const baseStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AdBanner: { template: '<div />' },
  TransactionModeTab: { template: '<div />' },
  ComplexCard: { template: '<div />' },
  Pagination: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
}

async function mountSuspended(component: any, stubs: Record<string, any>) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

describe('부동산 목록 지역 칩', () => {
  it('RealEstateSearchFilter 셀렉트가 사라지고 RegionChips 가 렌더된다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    const wrapper = await mountSuspended(m.default, {
      ...baseStubs,
      RegionChips: { template: '<div data-test="region-chips" />' },
      RealEstateSearchFilter: true,
    })
    expect(wrapper.find('[data-test="region-chips"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'RealEstateSearchFilter' }).exists()).toBe(false)
  })

  it('칩은 /real-estate/{type}/{slug} 로 링크한다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/index.vue')
    // RegionChips는 스텁하지 않고 실제 컴포넌트(+ 실제 SIDO_CHIPS)를 렌더해 href를 검증한다.
    const wrapper = await mountSuspended(m.default, baseStubs)
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/real-estate/apt-sale/seoul')
    expect(hrefs).toContain('/real-estate/apt-sale/jeonnamgwangju')
  })
})
