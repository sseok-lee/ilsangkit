import { config } from '@vue/test-utils'
import { vi } from 'vitest'

// Mock Nuxt auto-imports
config.global.mocks = {
  $config: {
    public: {
      apiBase: 'http://localhost:8000',
      kakaoMapKey: 'test-key',
      gaId: '',
    },
  },
}

// Mock useRuntimeConfig globally
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      apiBase: 'http://localhost:8000',
      kakaoMapKey: 'test-key',
      gaId: '',
    },
  }),
}))

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
})
