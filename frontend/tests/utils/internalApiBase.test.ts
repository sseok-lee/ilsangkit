import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseRuntimeConfig = vi.fn()
vi.mock('#imports', () => ({ useRuntimeConfig: mockUseRuntimeConfig }))

describe('getInternalApiBase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('runtimeConfig.internalApiBase 값을 반환한다', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://127.0.0.1:8000')
  })

  it('trailing slash를 제거한다', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000///',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://127.0.0.1:8000')
  })

  it('internalApiBase 미설정 시 public.apiBase 로 fallback', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('https://ilsangkit.co.kr')
  })

  it('둘 다 미설정 시 http://localhost:8000 으로 fallback', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://localhost:8000')
  })

  it('첫 호출 시 부팅 로그를 1회 출력한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    getInternalApiBase()
    getInternalApiBase()
    getInternalApiBase()
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy.mock.calls[0][0]).toMatch(/\[internalApiBase\].*resolved: http:\/\/127\.0\.0\.1:8000/)
    infoSpy.mockRestore()
  })

  it('production 환경에서 internalApiBase 미설정이면 WARN을 출력한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    try {
      const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
      getInternalApiBase()
      expect(infoSpy.mock.calls[0][0]).toMatch(/WARN.*falling back/)
    } finally {
      process.env.NODE_ENV = originalEnv
      infoSpy.mockRestore()
    }
  })
})
