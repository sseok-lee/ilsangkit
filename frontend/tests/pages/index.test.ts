import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, readonly } from 'vue'
import IndexPage from '~/pages/index.vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).readonly = readonly

// Mock navigateTo
const mockNavigateTo = vi.fn()
;(globalThis as any).navigateTo = mockNavigateTo

// Mock composables
const mockSetWebsiteSchema = vi.fn()
const mockSetOrganizationSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setWebsiteSchema: mockSetWebsiteSchema,
    setItemListSchema: vi.fn(),
    setOrganizationSchema: mockSetOrganizationSchema,
    setDatasetSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setHomeMeta: vi.fn(),
    setMeta: vi.fn(),
  }),
}))

const sampleRegion = { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam', district: '강남구', pricePerPyeong: 5000, txnCount: 45, changePct: 3.2, volumeChangePct: 10 }
const sampleHotspotBundle = {
  sale: { rising: [sampleRegion], falling: [sampleRegion], active: [sampleRegion] },
  jeonse: { rising: [sampleRegion], falling: [sampleRegion], active: [sampleRegion] },
  wolse: { active: [sampleRegion] },
}

// home-page useAsyncData를 dashboard·recentGuides 페이로드로 가짜 응답.
// (index.vue 의 pageData useAsyncData 와 동일한 key 매칭)
const homePagePayload = {
  dashboard: {
    total: 100000,
    buildingCount: 50000,
    subscriptionActiveCount: 5,
    newlyListedToday: 12,
    realEstateTrends: [],
    trendingBuildings: { sale: [], jeonse: [], wolse: [] },
    subscriptionSummary: { closingThisWeek: 0, upcomingNextWeek: 0, avgSupplyPrice: null, imminent: [] },
    realEstateHotspots: { apt: sampleHotspotBundle },
  },
  recentGuides: [],
}

;(globalThis as any).useAsyncData = vi.fn((key?: string, _fetcher?: () => unknown) => {
  const data = key === 'home-page' ? ref(homePagePayload) : ref(null)
  const result = {
    data,
    status: ref('idle'),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(false),
  }
  return Object.assign(Promise.resolve(result), result)
})

// Helper to mount async components with Suspense
async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    options,
  )
  await flushPromises()
  return wrapper
}

describe('Index Page', () => {
  beforeEach(() => {
    mockNavigateTo.mockClear()
    mockSetWebsiteSchema.mockClear()
    mockSetOrganizationSchema.mockClear()
  })

  it('renders hero title and subtitle', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('우리 동네 정보')
    expect(wrapper.text()).toContain('한번에')
  })

  it('renders search input', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="단지명"]')
    expect(searchInput.exists()).toBe(true)
  })

  it('renders real estate section', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('부동산')
  })

  it('renders stats chips with key labels', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활시설')
    expect(wrapper.text()).toContain('진행중 청약')
  })

  it('renders the three new home sections and ad banners', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // HomeHotspotSignals replaces HomeMarketStats — check for its heading text (requires hotspot data)
    expect(wrapper.text()).toContain('오늘의 부동산 시장')
    // HomeSubscriptionSection is present
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.findAll('.stub-ad-banner').length).toBeGreaterThanOrEqual(1)
  })

  it('renders "빠른 생활시설 찾기" 16-icon grid (전 시설 카테고리 + 지하철)', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('빠른 생활시설 찾기')
    // 기존 대표
    expect(wrapper.text()).toContain('병원')
    expect(wrapper.text()).toContain('약국')
    expect(wrapper.text()).toContain('학교')
    expect(wrapper.text()).toContain('쓰레기')
    // 신규 추가분
    expect(wrapper.text()).toContain('도서관')
    expect(wrapper.text()).toContain('공원')
    expect(wrapper.text()).toContain('체육시설')
  })

  it('renders "인기 지역" chip row', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('인기 지역')
  })

  it('navigates to search page when search is triggered', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="단지명"]')
    await searchInput.setValue('화장실')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%ED%99%94%EC%9E%A5%EC%8B%A4')
  })

  it('does not navigate when search is empty', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="단지명"]')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('setOrganizationSchema를 호출한다', async () => {
    await mountSuspended(IndexPage)

    expect(mockSetOrganizationSchema).toHaveBeenCalled()
  })

  it('applies responsive layout root class', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const indexRoot = wrapper.find('.flex.flex-col')
    expect(indexRoot.exists()).toBe(true)
  })
})

describe('Hero image optimization', () => {
  it('hero 이미지에 width, height 속성 존재', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('width')).toBeTruthy()
      expect(img.attributes('height')).toBeTruthy()
    })
  })

  it('hero 이미지가 .webp 포맷 사용', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('src')).toMatch(/\.webp/)
    })
  })

  it('장식 이미지: aria-hidden="true"와 alt="" 유지', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('aria-hidden')).toBe('true')
      expect(img.attributes('alt')).toBeTruthy()
    })
  })

  it('hero 이미지에 loading 속성 존재', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('loading')).toBeTruthy()
    })
  })
})
