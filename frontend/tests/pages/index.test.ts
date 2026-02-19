import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import IndexPage from '~/pages/index.vue'

// Mock navigateTo
const mockNavigateTo = vi.fn()

// Make navigateTo globally available
;(globalThis as any).navigateTo = mockNavigateTo

// Helper to mount async components with Suspense
async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options?.props),
        })
      },
    }),
    options,
  )
  await flushPromises()
  return wrapper
}

describe('Index Page', () => {
  beforeEach(() => {
    mockNavigateTo.mockClear()
  })

  it('renders title and subtitle', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // New Stitch design has Korean title
    expect(wrapper.text()).toContain('내 주변 생활 편의 정보')
    expect(wrapper.text()).toContain('한 번에 찾기')
    // Mobile subtitle
    expect(wrapper.text()).toContain('지금 필요한 생활 시설을')
  })

  it('renders search input', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Search input is now a direct input element, not a separate component
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    expect(searchInput.exists()).toBe(true)
  })

  it('renders category chips and cards', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Categories are now rendered directly in the page
    expect(wrapper.text()).toContain('화장실')
    expect(wrapper.text()).toContain('쓰레기')
    expect(wrapper.text()).toContain('와이파이')
  })

  it('renders stats banner', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활 편의')
    expect(wrapper.text()).toContain('건강/안전')
    expect(wrapper.text()).toContain('문화/환경')
  })

  it('renders popular regions section', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('인기 지역')
    expect(wrapper.text()).toContain('서울')
    expect(wrapper.text()).toContain('부산')
    expect(wrapper.text()).toContain('인천')
  })

  it('navigates to search page when search is triggered', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Set search keyword
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.setValue('화장실')

    // Trigger search with Enter key
    await searchInput.trigger('keydown.enter')

    // Should navigate to /search with keyword (URL encoded)
    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%ED%99%94%EC%9E%A5%EC%8B%A4')
  })

  it('does not navigate when search is empty', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Trigger search without keyword
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('applies responsive layout classes', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Check for Suspense wrapper's child
    const indexRoot = wrapper.find('.flex.flex-col')
    expect(indexRoot.exists()).toBe(true)
  })

  it('popular region buttons navigate to search with region', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const regionButtons = wrapper.findAll('[data-testid^="region-"]')
    expect(regionButtons.length).toBeGreaterThan(0)

    await regionButtons[0].trigger('click')

    expect(mockNavigateTo).toHaveBeenCalledWith(expect.stringContaining('/search'))
  })

  it('renders grouped category sections', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활 편의')
    expect(wrapper.text()).toContain('건강/안전')
    expect(wrapper.text()).toContain('문화/환경')
  })
})
