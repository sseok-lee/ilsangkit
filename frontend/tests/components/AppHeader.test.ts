import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '~/app/components/common/AppHeader.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'index', component: { template: '<div>Home</div>' } },
    { path: '/toilet', name: 'toilet', component: { template: '<div>Toilet</div>' } },
    { path: '/trash', name: 'trash', component: { template: '<div>Trash</div>' } },
    { path: '/wifi', name: 'wifi', component: { template: '<div>Wifi</div>' } },
  ],
})

describe('AppHeader', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
        stubs: {
          NuxtLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })
  })

  describe('Logo', () => {
    it('should render logo with text "일상킷"', () => {
      expect(wrapper.text()).toContain('일상킷')
    })

    it('should have logo link to home', () => {
      const logoLink = wrapper.find('a[href="/"]')
      expect(logoLink.exists()).toBe(true)
      expect(logoLink.text()).toContain('일상킷')
    })
  })

  describe('Navigation', () => {
    it('should render navigation menu', () => {
      const nav = wrapper.find('nav')
      expect(nav.exists()).toBe(true)
    })

    it('should have links to all category pages', () => {
      const links = wrapper.findAll('nav a')
      const hrefs = links.map((link) => link.attributes('href'))

      expect(hrefs).toContain('/toilet')
      expect(hrefs).toContain('/trash')
      expect(hrefs).toContain('/wifi')
    })

    it('should display Korean labels for categories', () => {
      const nav = wrapper.find('nav')
      const text = nav.text()

      expect(text).toContain('화장실')
      expect(text).toContain('쓰레기')
      expect(text).toContain('와이파이')
    })
  })

  describe('Mobile Menu', () => {
    it('should have hamburger menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')
      expect(menuButton.exists()).toBe(true)
    })

    it('should toggle mobile menu when hamburger is clicked', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')

      // Initially closed
      let mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      expect(mobileMenu.exists()).toBe(false)

      // Open menu
      await menuButton.trigger('click')
      mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      expect(mobileMenu.exists()).toBe(true)

      // Close menu
      await menuButton.trigger('click')
      mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      expect(mobileMenu.exists()).toBe(false)
    })

    it('should have category links in mobile menu', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const links = mobileMenu.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))

      expect(hrefs).toContain('/toilet')
      expect(hrefs).toContain('/trash')
      expect(hrefs).toContain('/wifi')
    })
  })

  describe('Responsive Design', () => {
    it('should have mobile menu button with md:hidden class', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')
      expect(menuButton.classes()).toContain('md:hidden')
    })

    it('should have desktop navigation with hidden mobile class', () => {
      const desktopNav = wrapper.find('nav.hidden.md\\:flex')
      expect(desktopNav.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')
      expect(menuButton.attributes('aria-label')).toBe('메뉴 열기')
    })

    it('should have minimum 44px touch target for menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴 열기"]')
      expect(menuButton.classes()).toContain('min-h-11')
      expect(menuButton.classes()).toContain('min-w-11')
    })
  })
})
