import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseRuntimeConfig = vi.fn()

vi.stubGlobal('useRuntimeConfig', mockUseRuntimeConfig)

import { useApiBase } from '~/composables/useApiBase'

describe('useApiBase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', 'http://localhost:3000/')
  })

  it('브라우저에서 localhost API_BASE는 same-origin proxy로 정규화한다', () => {
    mockUseRuntimeConfig.mockReturnValue({
      public: {
        apiBase: 'http://localhost:8000',
      },
    })

    expect(useApiBase()).toBe('')
  })

  it('브라우저에서 현재 origin과 같은 API_BASE는 빈 문자열로 정규화한다', () => {
    mockUseRuntimeConfig.mockReturnValue({
      public: {
        apiBase: window.location.origin,
      },
    })

    expect(useApiBase()).toBe('')
  })

  it('외부 HTTPS API_BASE는 그대로 유지한다', () => {
    mockUseRuntimeConfig.mockReturnValue({
      public: {
        apiBase: 'https://api.example.com',
      },
    })

    expect(useApiBase()).toBe('https://api.example.com')
  })

  describe('SSR (no window)', () => {
    let originalWindow: typeof window

    beforeEach(() => {
      originalWindow = globalThis.window
      vi.stubGlobal('window', undefined)
    })

    afterEach(() => {
      vi.stubGlobal('window', originalWindow)
    })

    it('SSR에선 internalApiBase 를 반환한다', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: 'http://127.0.0.1:8000',
        public: { apiBase: 'https://ilsangkit.co.kr' },
      })
      expect(useApiBase()).toBe('http://127.0.0.1:8000')
    })

    it('SSR에서 internalApiBase 미설정 시 public.apiBase 로 fallback', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: '',
        public: { apiBase: 'https://ilsangkit.co.kr' },
      })
      expect(useApiBase()).toBe('https://ilsangkit.co.kr')
    })

    it('SSR에서 internalApiBase trailing slash 정규화', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: 'http://127.0.0.1:8000/',
        public: { apiBase: '' },
      })
      expect(useApiBase()).toBe('http://127.0.0.1:8000')
    })
  })
})
