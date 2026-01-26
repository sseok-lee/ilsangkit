import { config } from '@vue/test-utils'

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

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
})
