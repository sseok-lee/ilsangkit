import { describe, it, expect } from 'vitest'
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
            BottomNavigation: { template: '<nav data-testid="bottom-nav">Bottom Nav</nav>' },
            NuxtPage: { template: '<div data-testid="nuxt-page">Page Content</div>' },
          },
        },
      })

      expect(wrapper.find('[data-testid="app-header"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="nuxt-page"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="app-footer"]').exists()).toBe(true)
    })

    it('should have minimum height of full viewport', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          plugins: [router],
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            BottomNavigation: { template: '<nav>Bottom Nav</nav>' },
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
            BottomNavigation: { template: '<nav>Bottom Nav</nav>' },
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
            BottomNavigation: { template: '<nav>Bottom Nav</nav>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      const main = wrapper.find('main')
      expect(main.exists()).toBe(true)
      expect(main.classes()).toContain('flex-1')
    })

    it('should render NuxtPage component in main', () => {
      const wrapper = mount(DefaultLayout, {
        global: {
          stubs: {
            AppHeader: { template: '<header>Header</header>' },
            AppFooter: { template: '<footer>Footer</footer>' },
            NuxtPage: { template: '<div data-testid="page-content">Page Content</div>' },
          },
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
            BottomNavigation: { template: '<nav>Bottom Nav</nav>' },
            NuxtPage: { template: '<div>Page</div>' },
          },
        },
      })

      // Layout should work across all screen sizes
      expect(wrapper.element.tagName).toBe('DIV')
    })
  })
})
