import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '~/app/pages/index.vue'

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

    expect(wrapper.text()).toContain('일상킷')
    expect(wrapper.text()).toContain('내 주변 생활 편의 정보, 한 번에 찾기')
    expect(wrapper.text()).toContain('위치 기반으로 공공화장실')
  })

  it('renders search input component', () => {
    const wrapper = mount(IndexPage)

    const searchInput = wrapper.findComponent({ name: 'SearchInput' })
    expect(searchInput.exists()).toBe(true)
  })

  it('renders category chips component', () => {
    const wrapper = mount(IndexPage)

    const categoryChips = wrapper.findComponent({ name: 'CategoryChips' })
    expect(categoryChips.exists()).toBe(true)
  })

  it('renders current location search button', () => {
    const wrapper = mount(IndexPage)

    const locationButton = wrapper.find('[data-testid="location-button"]')
    expect(locationButton.exists()).toBe(true)
    expect(locationButton.text()).toContain('현재 위치에서 검색')
  })

  it('renders popular regions section', () => {
    const wrapper = mount(IndexPage)

    expect(wrapper.text()).toContain('인기 지역')
    expect(wrapper.text()).toContain('서울 강남구')
    expect(wrapper.text()).toContain('서울 송파구')
    expect(wrapper.text()).toContain('부산 해운대구')
  })

  it('navigates to search page when search is triggered', async () => {
    const wrapper = mount(IndexPage)

    // Set search keyword
    const searchInput = wrapper.findComponent({ name: 'SearchInput' })
    await searchInput.vm.$emit('update:modelValue', '화장실')

    // Trigger search
    await searchInput.vm.$emit('search')

    // Should navigate to /search with keyword (URL encoded)
    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%ED%99%94%EC%9E%A5%EC%8B%A4')
  })

  it('navigates to search page with category when category is selected', async () => {
    const wrapper = mount(IndexPage)

    // Select category
    const categoryChips = wrapper.findComponent({ name: 'CategoryChips' })
    await categoryChips.vm.$emit('select', 'toilet')

    // Set search keyword
    const searchInput = wrapper.findComponent({ name: 'SearchInput' })
    await searchInput.vm.$emit('update:modelValue', '강남')

    // Trigger search
    await searchInput.vm.$emit('search')

    // Should navigate with both keyword and category (keyword URL encoded)
    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%EA%B0%95%EB%82%A8&category=toilet')
  })

  it('navigates to search page with only category when no keyword', async () => {
    const wrapper = mount(IndexPage)

    // Select category
    const categoryChips = wrapper.findComponent({ name: 'CategoryChips' })
    await categoryChips.vm.$emit('select', 'wifi')

    // Trigger search without keyword
    const searchInput = wrapper.findComponent({ name: 'SearchInput' })
    await searchInput.vm.$emit('search')

    expect(mockNavigateTo).toHaveBeenCalledWith('/search?category=wifi')
  })

  it('does not navigate when search is empty', async () => {
    const wrapper = mount(IndexPage)

    // Trigger search without keyword or category
    const searchInput = wrapper.findComponent({ name: 'SearchInput' })
    await searchInput.vm.$emit('search')

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('applies responsive layout classes', () => {
    const wrapper = mount(IndexPage)

    // Check for responsive container
    const container = wrapper.find('[data-testid="main-container"]')
    expect(container.classes()).toContain('container')
  })

  it('popular region buttons navigate to search with region', async () => {
    const wrapper = mount(IndexPage)

    const regionButtons = wrapper.findAll('[data-testid^="region-"]')
    expect(regionButtons.length).toBeGreaterThan(0)

    await regionButtons[0].trigger('click')

    expect(mockNavigateTo).toHaveBeenCalledWith(expect.stringContaining('/search'))
  })
})
