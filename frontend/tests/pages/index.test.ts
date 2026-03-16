import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import IndexPage from '~/pages/index.vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// Mock navigateTo
const mockNavigateTo = vi.fn()
;(globalThis as any).navigateTo = mockNavigateTo

// Mock composables
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setWebsiteSchema: vi.fn(),
    setItemListSchema: vi.fn(),
  }),
}))

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({
    setHomeMeta: vi.fn(),
    setMeta: vi.fn(),
  }),
}))

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

    // New design hero text
    expect(wrapper.text()).toContain('우리 동네')
    expect(wrapper.text()).toContain('얼마나 살기 좋을까')
  })

  it('renders search input', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Search input exists with new placeholder
    const searchInput = wrapper.find('input[placeholder*="검색"]')
    expect(searchInput.exists()).toBe(true)
  })

  it('renders real estate section', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Real estate section header
    expect(wrapper.text()).toContain('부동산')
  })

  it('renders stats banner with key labels', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Stats labels present
    expect(wrapper.text()).toContain('생활시설')
    expect(wrapper.text()).toContain('전국 시군구')
  })

  it('navigates to search page when search is triggered', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.setValue('화장실')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).toHaveBeenCalledWith('/search?keyword=%ED%99%94%EC%9E%A5%EC%8B%A4')
  })

  it('does not navigate when search is empty', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="검색"]')
    await searchInput.trigger('keydown.enter')

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('applies responsive layout classes', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const indexRoot = wrapper.find('.flex.flex-col')
    expect(indexRoot.exists()).toBe(true)
  })

  it('renders grouped category sections', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활/편의')
    expect(wrapper.text()).toContain('교육/육아')
    expect(wrapper.text()).toContain('건강/안전')
    expect(wrapper.text()).toContain('환경/생활')
  })
})

describe('Hero image optimization', () => {
  it('hero 이미지에 width, height 속성 존재', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('width')).toBeTruthy()
      expect(img.attributes('height')).toBeTruthy()
    })
  })

  it('hero 이미지가 .webp 포맷 사용', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('src')).toMatch(/\.webp/)
    })
  })

  it('장식 이미지: aria-hidden="true"와 alt="" 유지', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('aria-hidden')).toBe('true')
      expect(img.attributes('alt')).toBe('')
    })
  })

  it('hero 이미지에 loading 속성 존재', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const imgs = wrapper.findAll('section > div > img[aria-hidden="true"]')
    expect(imgs.length).toBeGreaterThan(0)
    imgs.forEach(img => {
      expect(img.attributes('loading')).toBeTruthy()
    })
  })
})
