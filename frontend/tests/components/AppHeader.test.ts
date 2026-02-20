import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '~/components/common/AppHeader.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'index', component: { template: '<div>Home</div>' } },
    { path: '/search', name: 'search', component: { template: '<div>Search</div>' } },
    { path: '/about', name: 'about', component: { template: '<div>About</div>' } },
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
    it('should render logo image with alt text', () => {
      const logoImg = wrapper.find('img[alt="일상킷"]')
      expect(logoImg.exists()).toBe(true)
      expect(logoImg.attributes('src')).toBe('/icons/logo.webp')
    })

    it('should have logo link to home', () => {
      const logoLink = wrapper.find('a[href="/"]')
      expect(logoLink.exists()).toBe(true)
      expect(logoLink.find('img').exists()).toBe(true)
    })
  })

  describe('Desktop Navigation', () => {
    it('should render navigation with group dropdowns', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      expect(nav.exists()).toBe(true)
    })

    it('should display group titles', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      const text = nav.text()
      expect(text).toContain('생활 편의')
      expect(text).toContain('건강/안전')
      expect(text).toContain('문화/환경')
    })

    it('should have utility links for search and about', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      const links = nav.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))
      expect(hrefs).toContain('/search')
      expect(hrefs).toContain('/about')
    })

    it('should show dropdown with category links on hover', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.md\\:flex .relative')
      expect(groupButtons.length).toBe(3)

      // Hover over first group (생활 편의)
      await groupButtons[0].trigger('mouseenter')

      // Dropdown should appear with category links
      const dropdown = groupButtons[0].find('.absolute')
      expect(dropdown.exists()).toBe(true)
      const links = dropdown.findAll('a')
      const hrefs = links.map((l) => l.attributes('href'))
      expect(hrefs).toContain('/toilet')
      expect(hrefs).toContain('/wifi')
      expect(hrefs).toContain('/parking')
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

    it('should have category links in mobile menu grouped by section', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const links = mobileMenu.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))

      // Category links
      expect(hrefs).toContain('/toilet')
      expect(hrefs).toContain('/trash')
      expect(hrefs).toContain('/wifi')
      expect(hrefs).toContain('/clothes')
      expect(hrefs).toContain('/kiosk')
    })

    it('should display group headers in mobile menu', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const text = mobileMenu.text()
      expect(text).toContain('생활 편의')
      expect(text).toContain('건강/안전')
      expect(text).toContain('문화/환경')
    })

    it('should have about link in mobile menu', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const links = mobileMenu.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))
      expect(hrefs).toContain('/about')
    })
  })

  describe('Responsive Design', () => {
    it('should have mobile menu button with md:hidden class', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      expect(menuButton.classes()).toContain('md:hidden')
    })

    it('should have desktop navigation with hidden mobile class', () => {
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
      const darkModeButton = wrapper.find('button[aria-label="다크모드 전환"]')
      expect(darkModeButton.exists()).toBe(true)
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
