import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'

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
    adsEnabled: true,
  },
}

// Make useRuntimeConfig globally available
;(globalThis as any).useRuntimeConfig = () => mockRuntimeConfig

// Mock useApiBase composable globally — returns same default as backend localhost dev
;(globalThis as any).useApiBase = () => 'http://localhost:8000'

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

// useState 키별 공유 ref 스토어 — useAdsPolicy 등 composable 단위테스트용
const __useStateStore = new Map<string, ReturnType<typeof ref>>()
;(globalThis as any).useState = <T>(key: string, init?: () => T) => {
  if (!__useStateStore.has(key)) {
    __useStateStore.set(key, ref(init ? init() : (null as unknown as T)))
  }
  return __useStateStore.get(key)
}
;(globalThis as any).__resetUseState = () => __useStateStore.clear()

// Passthrough mock for defineNuxtRouteMiddleware — middleware files must be importable in vitest
;(globalThis as any).defineNuxtRouteMiddleware = (fn: any) => fn

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
  // @nuxt/image 컴포넌트 → 테스트에선 단순 img로 패스스루
  NuxtImg: {
    template: '<img :src="src" :alt="alt" :width="width" :height="height" />',
    props: ['src', 'alt', 'width', 'height', 'sizes', 'format', 'quality', 'loading', 'decoding'],
  },
  // 광고 컴포넌트는 window.adsbygoogle/Nuxt 라우터에 의존 → 테스트에서 무해 스터브
  AdBanner: { template: '<div class="stub-ad-banner" />' },
  // 홈의 청약 섹션은 useAsyncData 의존 → 구조 테스트에서 스터브
  HomeSubscriptionSection: { template: '<section data-testid="subscription" class="stub-home-subscription" />' },
  // 홈 인기단지 섹션
  HomeTrendingBuildings: { template: '<section data-testid="trending-buildings" />' },
}

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
})
