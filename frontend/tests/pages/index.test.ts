import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '~/pages/index.vue'

// Mock navigateTo
const mockNavigateTo = vi.fn()

// Make navigateTo globally available
;(globalThis as any).navigateTo = mockNavigateTo

describe('Index Page', () => {
  beforeEach(() => {
    mockNavigateTo.mockClear()
  })

  it('renders title and subtitle', () => {
    const wrapper = mount(IndexPage)

    // New Stitch design has Korean title
    expect(wrapper.text()).toContain('내 주변 생활 편의 정보')
    expect(wrapper.text()).toContain('한 번에 찾기')
    // Mobile subtitle
    expect(wrapper.text()).toContain('화장실부터 와이파이까지')
  })

  it('renders search input', () => {
    const wrapper = mount(IndexPage)

    // Search input is now a direct input element, not a separate component
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    expect(searchInput.exists()).toBe(true)
  })

  it('renders category chips and cards', () => {
    const wrapper = mount(IndexPage)

    // Categories are now rendered directly in the page
    expect(wrapper.text()).toContain('화장실')
    expect(wrapper.text()).toContain('쓰레기')
    expect(wrapper.text()).toContain('와이파이')
  })

  it('renders current location search button', () => {
    const wrapper = mount(IndexPage)

    const locationButton = wrapper.find('[data-testid="location-button"]')
    expect(locationButton.exists()).toBe(true)
    expect(locationButton.text()).toContain('현재 위치로 검색')
  })

  it('renders popular regions section', () => {
    const wrapper = mount(IndexPage)

    expect(wrapper.text()).toContain('인기 지역')
    expect(wrapper.text()).toContain('서울')
    expect(wrapper.text()).toContain('부산')
    expect(wrapper.text()).toContain('인천')
  })

  it('navigates to search page when search is triggered', async () => {
    const wrapper = mount(IndexPage)

    // Set search keyword
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.setValue('화장실')

    // Trigger search with Enter key
    await searchInput.trigger('keydown.enter')

    // Should navigate to /search with keyword (URL encoded)
    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%ED%99%94%EC%9E%A5%EC%8B%A4')
  })

  it('does not navigate when search is empty', async () => {
    const wrapper = mount(IndexPage)

    // Trigger search without keyword
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('applies responsive layout classes', () => {
    const wrapper = mount(IndexPage)

    // Check for root container with flexbox layout
    const rootDiv = wrapper.find('.min-h-screen')
    expect(rootDiv.exists()).toBe(true)
    expect(rootDiv.classes()).toContain('flex')
    expect(rootDiv.classes()).toContain('flex-col')
  })

  it('popular region buttons navigate to search with region', async () => {
    const wrapper = mount(IndexPage)

    const regionButtons = wrapper.findAll('[data-testid^="region-"]')
    expect(regionButtons.length).toBeGreaterThan(0)

    await regionButtons[0].trigger('click')

    expect(mockNavigateTo).toHaveBeenCalledWith(expect.stringContaining('/search'))
  })

  it('location button navigates to search with useLocation', async () => {
    const wrapper = mount(IndexPage)

    const locationButton = wrapper.find('[data-testid="location-button"]')
    await locationButton.trigger('click')

    expect(mockNavigateTo).toHaveBeenCalledWith('/search?useLocation=true')
  })
})
