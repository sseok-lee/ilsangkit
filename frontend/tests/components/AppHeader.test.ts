import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '~/components/common/AppHeader.vue'

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

      // Desktop nav shows all category links
      expect(hrefs).toContain('/search?category=toilet')
      expect(hrefs).toContain('/search?category=trash')
      expect(hrefs).toContain('/search?category=wifi')
      expect(hrefs).toContain('/search?category=clothes')
      expect(hrefs).toContain('/search?category=kiosk')
    })

    it('should display Korean labels for categories', () => {
      const nav = wrapper.find('nav')
      const text = nav.text()

      // Desktop nav shows: 화장실, 쓰레기, 와이파이, 의류수거함, 발급기
      expect(text).toContain('화장실')
      expect(text).toContain('쓰레기')
      expect(text).toContain('와이파이')
      expect(text).toContain('의류수거함')
      expect(text).toContain('발급기')
    })
  })

  describe('Mobile Menu', () => {
    it('should have hamburger menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      expect(menuButton.exists()).toBe(true)
    })

    it('should toggle mobile menu when hamburger is clicked', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')

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
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const links = mobileMenu.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))

      // Mobile menu uses search page with category query params
      expect(hrefs).toContain('/search?category=toilet')
      expect(hrefs).toContain('/search?category=trash')
      expect(hrefs).toContain('/search?category=wifi')
      expect(hrefs).toContain('/search?category=clothes')
      expect(hrefs).toContain('/search?category=kiosk')
    })
  })

  describe('Responsive Design', () => {
    it('should have mobile menu button with md:hidden class', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      expect(menuButton.classes()).toContain('md:hidden')
    })

    it('should have desktop navigation with hidden mobile class', () => {
      // Desktop nav uses hidden md:flex classes
      const desktopNav = wrapper.find('nav.hidden.md\\:flex')
      expect(desktopNav.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      expect(menuButton.attributes('aria-label')).toBe('메뉴')
    })

    it('should have proper ARIA labels on desktop action buttons', () => {
      const searchButton = wrapper.find('button[aria-label="검색"]')
      const darkModeButton = wrapper.find('button[aria-label="다크모드 전환"]')
      expect(searchButton.attributes('aria-label')).toBe('검색')
      expect(darkModeButton.attributes('aria-label')).toBe('다크모드 전환')
    })

    it('should have minimum 40px touch target for menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      // size-10 = 40px (2.5rem)
      expect(menuButton.classes()).toContain('size-10')
    })
  })

  describe('Props', () => {
    it('should support transparent mode', () => {
      const transparentWrapper = mount(AppHeader, {
        props: { transparent: true },
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

      const header = transparentWrapper.find('header')
      expect(header.classes()).toContain('bg-transparent')
    })

    it('should show back button when showBackButton is true', () => {
      const backButtonWrapper = mount(AppHeader, {
        props: { showBackButton: true },
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

      const backButton = backButtonWrapper.find('button[aria-label="뒤로가기"]')
      expect(backButton.exists()).toBe(true)
    })

    it('should emit back event when back button is clicked', async () => {
      const backButtonWrapper = mount(AppHeader, {
        props: { showBackButton: true },
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

      const backButton = backButtonWrapper.find('button[aria-label="뒤로가기"]')
      await backButton.trigger('click')

      expect(backButtonWrapper.emitted('back')).toBeTruthy()
    })
  })
})
