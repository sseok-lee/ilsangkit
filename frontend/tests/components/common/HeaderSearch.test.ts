import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HeaderSearch from '~/components/common/HeaderSearch.vue'

vi.stubGlobal('navigateTo', vi.fn())

// setup.ts 전역 useRoute(path '/') 를 케이스별로 덮어쓸 수 있게 헬퍼
function setRoute(route: Record<string, unknown>) {
  vi.stubGlobal('useRoute', () => route)
}

describe('HeaderSearch 통합 검색 라우팅', () => {
  beforeEach(() => {
    vi.mocked(navigateTo).mockClear()
    setRoute({ path: '/', params: {}, query: {} }) // 홈
  })
  afterEach(() => {
    // 전역 useRoute 를 setup.ts 기본으로 되돌림(다른 파일 오염 방지)
    setRoute({ path: '/', params: {}, query: {} })
  })

  it('홈: 엔터 시 /search?keyword= 로 이동', async () => {
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('강남 래미안')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('강남 래미안'))
  })

  it('시설 카테고리 페이지에서도 submit은 통합 /search로 간다', async () => {
    setRoute({ path: '/toilet', params: { category: 'toilet' }, query: {} })
    const wrapper = mount(HeaderSearch, { global: { stubs: { SearchAutocomplete: true } } })
    const input = wrapper.find('input[aria-label="통합 검색"]')
    await input.setValue('강남')
    await input.trigger('keydown', { key: 'Enter' })
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=%EA%B0%95%EB%82%A8')
  })

  it('지역 시설목록 페이지(/seoul/gangnam/toilet)에서도 통합 /search로 이동(city 파라미터 없음)', async () => {
    setRoute({ path: '/seoul/gangnam/toilet', params: { city: 'seoul', district: 'gangnam', category: 'toilet' }, query: {} })
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('공원')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('공원'))
  })

  it('빈 입력은 라우팅하지 않음', async () => {
    const wrapper = mount(HeaderSearch)
    await wrapper.find('input').trigger('keydown.enter')
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('mobile variant: 오버레이 열기 → 엔터 시 통합 /search로 이동', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } })
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('서울 화장실')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('서울 화장실'))
  })
})
