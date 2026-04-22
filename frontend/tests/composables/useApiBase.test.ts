import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
