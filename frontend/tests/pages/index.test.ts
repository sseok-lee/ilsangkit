import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, readonly } from 'vue'
import IndexPage from '~/pages/index.vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).readonly = readonly

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

  it('renders hero title and subtitle', async () => {
    const wrapper = await mountSuspended(IndexPage)

    // Wireframe 기반 새 히어로 카피
    expect(wrapper.text()).toContain('내 동네 부동산')
    expect(wrapper.text()).toContain('아파트 실거래가부터')
  })

  it('renders search input', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const searchInput = wrapper.find('input[placeholder*="검색"]')
    expect(searchInput.exists()).toBe(true)
  })

  it('renders real estate section', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('부동산')
  })

  it('renders stats chips with key labels', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('생활시설')
    expect(wrapper.text()).toContain('시군구')
  })

  it('renders new "오늘 확인할 정보" section', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('오늘 확인할 정보')
    expect(wrapper.text()).toContain('청약·임대')
  })

  it('renders "빠른 생활시설 찾기" 8-icon grid', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('빠른 생활시설 찾기')
    // 8개 아이콘 중 대표 4개 확인
    expect(wrapper.text()).toContain('병원')
    expect(wrapper.text()).toContain('약국')
    expect(wrapper.text()).toContain('학교')
    expect(wrapper.text()).toContain('쓰레기')
  })

  it('renders "인기 지역" chip row', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('인기 지역')
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

  it('applies responsive layout root class', async () => {
    const wrapper = await mountSuspended(IndexPage)

    const indexRoot = wrapper.find('.flex.flex-col')
    expect(indexRoot.exists()).toBe(true)
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
      expect(img.attributes('alt')).toBeTruthy()
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
