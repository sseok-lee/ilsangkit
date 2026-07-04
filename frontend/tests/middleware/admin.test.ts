import { afterEach, describe, expect, it, vi } from 'vitest'
import adminMiddleware from '~/middleware/admin'

// defineNuxtRouteMiddleware 는 tests/setup.ts 에서 전역 패스스루로 스텁되어 있어
// import 시 그대로 원본 async 함수를 받는다.

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin route middleware (client-only guard)', () => {
  it('checkSession() 이 false 면 /admin/login 으로 리다이렉트한다', async () => {
    const navigateToMock = vi.fn().mockReturnValue('redirect-result')
    const checkSessionMock = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('useAdminAuth', () => ({ checkSession: checkSessionMock }))

    const result = await (adminMiddleware as unknown as () => Promise<unknown>)()

    expect(checkSessionMock).toHaveBeenCalled()
    expect(navigateToMock).toHaveBeenCalledWith('/admin/login')
    expect(result).toBe('redirect-result')
  })

  it('checkSession() 이 true 면 통과한다(undefined 반환, 리다이렉트 없음)', async () => {
    const navigateToMock = vi.fn()
    const checkSessionMock = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('useAdminAuth', () => ({ checkSession: checkSessionMock }))

    const result = await (adminMiddleware as unknown as () => Promise<unknown>)()

    expect(checkSessionMock).toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })
})
