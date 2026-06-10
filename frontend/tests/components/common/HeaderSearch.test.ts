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

  it('mobile variant: 초기엔 입력창 없이 검색 아이콘만, 탭하면 오버레이 입력창이 열린다', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } })
    // 오버레이 열기 전: 입력창 없음
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click')
    // 오버레이 입력창 등장
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('mobile variant: 오버레이에서 엔터 시 /search로 이동', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } })
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('서울 화장실')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('서울 화장실'))
  })
})
