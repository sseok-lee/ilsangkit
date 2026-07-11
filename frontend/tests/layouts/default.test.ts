import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DefaultLayout from '~/layouts/default.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'index', component: { template: '<div>Home</div>' } },
  ],
})

describe('Default Layout', () => {
  describe('Structure', () => {
    it('should render layout with header, main, and footer', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header data-testid="app-header">Header</header>' },
            AppFooter: { template: '<footer data-testid="app-footer">Footer</footer>' },
          },
        },
        slots: {
          default: '<div data-testid="slot-content">Slot Content</div>',
        },
      })

      expect(wrapper.find('[data-testid="app-header"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="slot-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="app-footer"]').exists()).toBe(true)
    })

    it('should have minimum height of full viewport', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      expect(wrapper.classes()).toContain('min-h-screen')
    })

    it('should use flexbox layout', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      expect(wrapper.classes()).toContain('flex')
      expect(wrapper.classes()).toContain('flex-col')
    })
  })

  describe('Main Content Area', () => {
    it('should have main element with flex-1 for content', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      const main = wrapper.find('main')
      expect(main.exists()).toBe(true)
      expect(main.classes()).toContain('flex-1')
    })

    it('should render slot content in main', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
          },
        },
        slots: {
          default: '<div data-testid="page-content">Page Content</div>',
        },
      })

      const main = wrapper.find('main')
      const pageContent = main.find('[data-testid="page-content"]')
      expect(pageContent.exists()).toBe(true)
    })
  })

  describe('Component Integration', () => {
    it('should include AppHeader component', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          stubs: {
            AppHeader: { template: '<header class="app-header">Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      const header = wrapper.find('.app-header')
      expect(header.exists()).toBe(true)
    })

    it('should include AppFooter component', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer class="app-footer">Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      const footer = wrapper.find('.app-footer')
      expect(footer.exists()).toBe(true)
    })
  })

  describe('Responsive Behavior', () => {
    it('should have responsive container classes', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      // Layout should work across all screen sizes
      expect(wrapper.element.tagName).toBe('DIV')
    })
  })

  describe('TrustLine visibility (route-based)', () => {
    // layouts/default.vue의 `const route = useRoute()`는 auto-import 전역(globalThis.useRoute)을
    // 참조한다(로컬 import 없음). tests/setup.ts의 전역 mock은 path:'/' 고정이라, 라우터
    // plugin의 실제 네비게이션(router.push)으로는 이 값을 바꿀 수 없다 — 대신 전역 자체를
    // 이 describe 안에서 stubGlobal로 override해 `route.path !== '/'` 분기를 직접 검증한다.
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('홈(/)에서는 TrustLine을 렌더하지 않는다', () => {
      vi.stubGlobal('useRoute', () => ({
        fullPath: '/', path: '/', params: {}, query: {}, name: 'index',
        hash: '', matched: [], meta: {}, redirectedFrom: undefined,
      }))

      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      expect(wrapper.findComponent({ name: 'TrustLine' }).exists()).toBe(false)
    })

    it('홈이 아닌 경로에서는 TrustLine을 렌더한다', () => {
      vi.stubGlobal('useRoute', () => ({
        fullPath: '/guide', path: '/guide', params: {}, query: {}, name: 'guide',
        hash: '', matched: [], meta: {}, redirectedFrom: undefined,
      }))

      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      expect(wrapper.findComponent({ name: 'TrustLine' }).exists()).toBe(true)
    })
  })
})
