import { config } from '@vue/test-utils'
import { vi } from 'vitest'

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
