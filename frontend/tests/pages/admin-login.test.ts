import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginPage from '~/pages/admin/login.vue'

describe('admin login page', () => {
  let loginMock: ReturnType<typeof vi.fn>
  let navigateToMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    loginMock = vi.fn()
    navigateToMock = vi.fn()
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('useAdminAuth', () => ({
      login: loginMock,
      logout: vi.fn(),
      checkSession: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('비밀번호 입력 후 제출 시 useAdminAuth().login(password) 를 호출한다', async () => {
    loginMock.mockResolvedValueOnce(undefined)
    const wrapper = mount(LoginPage)

    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(loginMock).toHaveBeenCalledWith('secret123')
  })

  it('로그인 성공 시 /admin 으로 이동한다', async () => {
    loginMock.mockResolvedValueOnce(undefined)
    const wrapper = mount(LoginPage)

    await wrapper.find('input[type="password"]').setValue('secret123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(navigateToMock).toHaveBeenCalledWith('/admin')
  })

  it('로그인 실패 시 에러 메시지를 보여주고 이동하지 않는다', async () => {
    loginMock.mockRejectedValueOnce(new Error('unauthorized'))
    const wrapper = mount(LoginPage)

    await wrapper.find('input[type="password"]').setValue('wrong-password')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('비밀번호가 올바르지 않거나 로그인할 수 없습니다')
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
