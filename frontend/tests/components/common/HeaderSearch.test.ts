import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HeaderSearch from '~/components/common/HeaderSearch.vue'

// navigateTo is a Nuxt auto-import — stub it globally for this test file
vi.stubGlobal('navigateTo', vi.fn())

describe('HeaderSearch', () => {
  beforeEach(() => {
    vi.mocked(navigateTo).mockClear()
  })
  it('입력 후 엔터 시 /search로 이동', async () => {
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('강남 래미안')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('강남 래미안'))
  })
  it('빈 입력은 라우팅하지 않음', async () => {
    const wrapper = mount(HeaderSearch)
    await wrapper.find('input').trigger('keydown.enter')
    expect(navigateTo).not.toHaveBeenCalled()
  })
})
