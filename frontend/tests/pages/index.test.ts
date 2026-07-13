import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  // Task 4에서 히어로 3칸 통계 박스(실거래 부동산/진행중 청약/등록 시설) 제거.
  // '진행중 청약' 칩은 Task 5의 코발트 패널 4칸 스탯(newlyListedToday 포함)에서 재도입 예정.
  it('renders "생활시설" text (stats chip box moves to Task 5 4-stat panel)', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활시설')
  })

  it('renders the home sections and a single Coupang banner (no AdBanner)', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // HomeHotspotSignals replaces HomeMarketStats — check for its heading text (requires hotspot data)
    expect(wrapper.text()).toContain('오늘의 부동산 시장')
    // HomeSubscriptionSection is present
    expect(wrapper.find('section').exists()).toBe(true)
    // 홈은 AdBanner를 모두 제거하고 데이터 출처 위에 CoupangBanner 1개만 노출
    expect(wrapper.findAll('.stub-ad-banner').length).toBe(0)
    expect(wrapper.findAll('.stub-coupang-banner').length).toBe(1)
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

describe('오늘의 이슈 (recentArticles) section', () => {
  afterEach(() => {
    // 다른 테스트에 영향 없도록 기본 mock(recentArticles 없음)으로 복원
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
  })

  it('renders "오늘의 이슈" section with article links when recentArticles has items', async () => {
    ;(globalThis as any).useAsyncData = vi.fn((key?: string) => {
      const payload = {
        ...homePagePayload,
        recentArticles: [
          { id: 'art-1', slug: 'issue-1', title: '오늘의 이슈 기사 1', summary: '요약1', thumbnailUrl: null },
          { id: 'art-2', slug: 'issue-2', title: '오늘의 이슈 기사 2', summary: '요약2', thumbnailUrl: null },
        ],
      }
      const data = key === 'home-page' ? ref(payload) : ref(null)
      const result = { data, status: ref('idle'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
      return Object.assign(Promise.resolve(result), result)
    })

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('오늘의 이슈')
    expect(wrapper.text()).toContain('오늘의 이슈 기사 1')
    expect(wrapper.find('a[href="/article/issue-1"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/article"]').exists()).toBe(true)
  })

  it('does not render "오늘의 이슈" section or any /article/ link when recentArticles is empty', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.findAll('a[href^="/article/"]').length).toBe(0)
  })
})

describe('히어로 코발트 패널', () => {
  it('흐릿한 배경 사진(hero-bg webp)을 제거한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.findAll('img[src*="hero-bg"]').length).toBe(0)
  })

  it('단색 코발트 패널(bg-primary-press)로 렌더한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('.bg-primary-press').exists()).toBe(true)
  })

  it('출처 배지와 "매일 자동 동기화" 스탬프 라벨을 SSR 텍스트로 노출한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const text = wrapper.text()
    expect(text).toContain('국토교통부 실거래가')
    expect(text).toContain('매일 자동 동기화')
  })

  it('단일 h1을 유지한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.findAll('h1').length).toBe(1)
    expect(wrapper.find('h1').text()).toBe('부동산 실거래가·생활시설 통합 검색 - 일상킷')
  })
})
