import { config } from '@vue/test-utils'
import { vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// Mock useAsyncData globally - returns thenable object (same as Nuxt's pattern)
;(globalThis as any).useAsyncData = vi.fn((_key?: string, _fetcher?: () => unknown) => {
  const result = {
    data: ref(null),
    status: ref('idle'),
    error: ref(null),
    refresh: vi.fn(),
    pending: ref(false),
  }
  return Object.assign(Promise.resolve(result), result)
})

// Mock $fetch globally
;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: {} })

// Mock useRuntimeConfig globally - must be defined before any imports that use it
const mockRuntimeConfig = {
  public: {
    apiBase: 'http://localhost:8000',
    kakaoMapKey: 'test-key',
    gaId: '',
  },
}

// Make useRuntimeConfig globally available
;(globalThis as any).useRuntimeConfig = () => mockRuntimeConfig

// Mock Nuxt SEO/Head composables
;(globalThis as any).useSeoMeta = vi.fn()
;(globalThis as any).useHead = vi.fn()
;(globalThis as any).useServerSeoMeta = vi.fn()

// Mock useRoute (AdBanner 및 다수 컴포넌트가 사용)
;(globalThis as any).useRoute = () => ({
  fullPath: '/',
  path: '/',
  params: {},
  query: {},
  name: 'index',
  hash: '',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
})

// Mock Nuxt auto-imports
config.global.mocks = {
  $config: mockRuntimeConfig,
}

// Mock useRuntimeConfig in #app
vi.mock('#app', () => ({
  useRuntimeConfig: () => mockRuntimeConfig,
}))

// Stub Nuxt components
config.global.stubs = {
  NuxtLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  CategoryIcon: {
    template: '<img :alt="categoryId" :class="sizeClass" />',
    props: ['categoryId', 'size'],
    computed: {
      sizeClass(): string {
        const sizeMap: Record<string, string> = {
          sm: 'w-5 h-5',
          md: 'w-8 h-8',
          lg: 'w-12 h-12',
          xl: 'w-16 h-16',
        }
        return sizeMap[this.size as string] || 'w-8 h-8'
      },
    },
  },
  // 광고 컴포넌트는 window.adsbygoogle/Nuxt 라우터에 의존 → 테스트에서 무해 스터브
  AdBanner: { template: '<div class="stub-ad-banner" />' },
  AnchorAdBanner: { template: '<div class="stub-anchor-ad" />' },
  // 홈의 청약 섹션은 useAsyncData 의존 → 구조 테스트에서 스터브
  HomeSubscriptionSection: { template: '<section class="stub-home-subscription" />' },
  LazyRecentReviewCard: { template: '<div class="stub-review-card" />' },
  // 동네 설정 모달은 useRegions 의존 → AppHeader 등 외부 테스트에서 스터브
  RegionSettingsModal: { template: '<div class="stub-region-modal" />', props: ['open'] },
  // WasteDDayCard도 useRegions/useRegionStore 의존 → 외부 페이지 테스트에서 스터브
  WasteDDayCard: { template: '<div class="stub-waste-d-day" />' },
  ClientOnly: { template: '<div><slot /></div>' },
}

// Global test setup
beforeEach(() => {
  // 모든 테스트에 Pinia 인스턴스 보장 (개별 테스트가 store를 직접 다루는 경우 자기 setActivePinia로 덮어씀)
  setActivePinia(createPinia())
})
