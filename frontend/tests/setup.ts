import { config } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref } from 'vue'

// Mock useAsyncData globally - returns thenable object (same as Nuxt's pattern)
;(globalThis as any).useAsyncData = vi.fn((_key?: string, _fetcher?: Function) => {
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
}

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
})
