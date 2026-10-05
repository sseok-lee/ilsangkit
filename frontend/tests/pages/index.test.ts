/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { MountingOptions } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, readonly } from 'vue'
import type { Component } from 'vue'
import IndexPage from '~/pages/index.vue'

type NuxtTestGlobal = typeof globalThis & {
  ref: typeof ref
  computed: typeof computed
  watch: typeof watch
  watchEffect: typeof watchEffect
  onMounted: typeof onMounted
  onUnmounted: typeof onUnmounted
  readonly: typeof readonly
  navigateTo: Mock
  useAsyncData: Mock
}

const testGlobal = globalThis as NuxtTestGlobal

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
testGlobal.ref = ref
testGlobal.computed = computed
testGlobal.watch = watch
testGlobal.watchEffect = watchEffect
testGlobal.onMounted = onMounted
testGlobal.onUnmounted = onUnmounted
testGlobal.readonly = readonly

// Mock navigateTo
const mockNavigateTo = vi.fn()
testGlobal.navigateTo = mockNavigateTo

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

vi.mock('~/components/home/HomeMarketSection.vue', () => ({
  default: defineComponent({
    name: 'HomeMarketSection',
    setup() {
      return () => h('section', { 'data-testid': 'home-market' }, '우리 동네 실거래 흐름')
    },
  }),
}))

// home-page useAsyncData를 보조 콘텐츠 페이로드로 가짜 응답.
// (index.vue 의 pageData useAsyncData 와 동일한 key 매칭)
const homePagePayload = {
  recentGuides: [],
  recentArticles: [],
}

function mockDefaultHomePageUseAsyncData() {
  testGlobal.useAsyncData = vi.fn((key?: string) => {
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
}

mockDefaultHomePageUseAsyncData()

// Helper to mount async components with Suspense
async function mountSuspended(component: Component, options?: MountingOptions<Record<string, unknown>>) {
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
    mockDefaultHomePageUseAsyncData()
  })

  it('renders hero title and subtitle', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('집값부터')
    expect(wrapper.text()).toContain('청약 일정까지')
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

  it('renders the home sections and exactly 2 ad banners', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('우리 동네 실거래 흐름')
    // HomeSubscriptionSection is present
    expect(wrapper.find('section').exists()).toBe(true)
    // 홈 광고는 2개 — fold 아래 첫 섹션 경계 + 데이터 출처 위(구 쿠팡 자리).
    // 히어로 검색 위/안에는 두지 않는다(홈의 핵심 기능 + 콘텐츠 위 대형 광고 정책 리스크).
    expect(wrapper.findAll('.stub-ad-banner').length).toBe(2)
  })

  it('legacy dashboard 데이터 없이도 핵심 홈 화면을 렌더한다', async () => {
    testGlobal.useAsyncData = vi.fn((key?: string) => {
      const data = key === 'home-page' ? ref({ recentGuides: [], recentArticles: [] }) : ref(null)
      const result = {
        data,
        status: ref('idle'),
        error: ref(null),
        refresh: vi.fn(),
        pending: ref(false),
      }
      return Object.assign(Promise.resolve(result), result)
    })

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.find('.home-hero-shell').exists()).toBe(true)
    expect(wrapper.text()).toContain('우리 동네 실거래 흐름')
    expect(wrapper.text()).toContain('빠른 생활시설 찾기')
    expect(wrapper.text()).toContain('공공데이터 기반 서비스')
  })

  it('가이드·기사 보조 데이터가 실패해도 dashboard endpoint 없이 홈을 렌더한다', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/api/guides/recent') || url.includes('/api/articles/recent')) {
        throw new Error('optional content unavailable')
      }
      return { success: true, data: [] }
    })
    vi.stubGlobal('$fetch', fetchMock)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    testGlobal.useAsyncData = vi.fn((key?: string, handler?: () => Promise<unknown>, options?: { default?: () => unknown }) => {
      const data = ref(key === 'home-page' ? options?.default?.() : null)
      const result = {
        data,
        status: ref('idle'),
        error: ref(null),
        refresh: vi.fn(),
        pending: ref(false),
      }
      const promise = (async () => {
        if (key === 'home-page' && handler) {
          data.value = await handler()
        }
        return result
      })()
      return Object.assign(promise, result)
    })

    const wrapper = await mountSuspended(IndexPage)

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(requestedUrls.some((url) => url.includes('/api/guides/recent'))).toBe(true)
    expect(requestedUrls.some((url) => url.includes('/api/articles/recent'))).toBe(true)
    expect(requestedUrls.some((url) => url.includes('/api/meta/home-dashboard'))).toBe(false)
    expect(wrapper.find('.home-hero-shell').exists()).toBe(true)
    expect(wrapper.text()).toContain('우리 동네 실거래 흐름')
    expect(wrapper.text()).toContain('공공데이터 기반 서비스')

    warnSpy.mockRestore()
  })

  it('히어로 검색 영역보다 뒤에만 광고를 둔다 (fold 위 광고 금지)', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const html = wrapper.html()
    const firstAd = html.indexOf('stub-ad-banner')
    const hero = html.indexOf('우리 동네 실거래 흐름')
    expect(firstAd).toBeGreaterThan(-1)
    expect(hero).toBeGreaterThan(-1)
    // 첫 광고는 첫 콘텐츠 섹션(우리 동네 실거래 흐름) 뒤에 나와야 한다.
    expect(firstAd).toBeGreaterThan(hero)
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

  it('인기 지역 칩은 공통 칩(.ui-chip)이다', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const chip = wrapper.find('a[href="/seoul/"]')
    expect(chip.exists()).toBe(true)
    expect(chip.classes()).toContain('ui-chip')
    expect(chip.classes()).not.toContain('rounded-full')
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
    mockDefaultHomePageUseAsyncData()
  })

  it('renders "오늘의 이슈" section with article links when recentArticles has items', async () => {
    testGlobal.useAsyncData = vi.fn((key?: string) => {
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

describe('홈 흰색 2컬럼 히어로', () => {
  it('흐릿한 배경 사진(hero-bg webp)을 제거한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.findAll('img[src*="hero-bg"]').length).toBe(0)
  })

  it('기존 단색 코발트 패널을 쓰지 않고 흰색 hero shell로 렌더한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('.home-hero-shell').exists()).toBe(true)
    expect(wrapper.find('.bg-primary-press').exists()).toBe(false)
  })

  it('승인된 짧은 홈 히어로 카피를 렌더한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const text = wrapper.text()
    expect(text).toContain('집값부터')
    expect(text).toContain('청약 일정까지')
    expect(text).toContain('궁금한 동네의 집값과 새로운 입주 기회')
  })

  it('단일 h1을 유지한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.findAll('h1').length).toBe(1)
    expect(wrapper.find('h1').text()).toBe('부동산 실거래가·생활시설 통합 검색 - 일상킷')
  })
})

describe('히어로 목적지 링크', () => {
  it('실거래가·청약·생활시설 목적지 링크를 렌더한다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const t = wrapper.text()
    for (const label of ['실거래가', '청약', '공공임대']) {
      expect(t).toContain(label)
    }
    expect(wrapper.find('a[href="/real-estate"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/subscription"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/subscription/rent"]').exists()).toBe(true)
  })

  it('기존 글로벌 스탯 라벨은 렌더하지 않는다', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const t = wrapper.text()
    expect(t).not.toContain('실거래 부동산')
    expect(t).not.toContain('등록 시설')
    expect(t).not.toContain('오늘 신규')
  })
})
