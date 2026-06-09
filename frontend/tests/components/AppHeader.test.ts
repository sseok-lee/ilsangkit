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

    it('should display top-level nav buttons (부동산/청약·임대/생활시설)', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      const text = nav.text()
      expect(text).toContain('부동산')
      expect(text).toContain('청약·임대')
      expect(text).toContain('생활시설')
    })

    it('should have a search input and an about link', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      // 검색은 이제 링크가 아니라 HeaderSearch 입력창
      expect(wrapper.findComponent({ name: 'HeaderSearch' }).exists()).toBe(true)
      const hrefs = nav.findAll('a').map((link) => link.attributes('href'))
      expect(hrefs).toContain('/about')
    })

    it('생활시설 메가메뉴는 4개 그룹 열과 시설 카테고리 링크를 보여준다', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.md\\:flex [data-testid="nav-group"]')
      // 부동산=0, 청약·임대=1, 공매=2, 생활시설=3 (총 4개)
      expect(groupButtons.length).toBe(4)

      await groupButtons[3].trigger('mouseenter')

      const mega = wrapper.find('[data-testid="nav-mega-menu"]')
      expect(mega.exists()).toBe(true)

      const text = mega.text()
      expect(text).toContain('교육/육아')
      expect(text).toContain('건강/안전')
      expect(text).toContain('생활/편의')
      expect(text).toContain('환경/생활')

      const hrefs = mega.findAll('a').map((l) => l.attributes('href'))
      expect(hrefs).toContain('/school')    // 교육/육아
      expect(hrefs).toContain('/hospital')  // 건강/안전
      expect(hrefs).toContain('/park')      // 생활/편의
      expect(hrefs).toContain('/clothes')   // 환경/생활
    })

    it('should show 4 real estate links including hub in navigation', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.md\\:flex [data-testid="nav-group"]')
      // 부동산 그룹 (첫 번째, index 0)
      await groupButtons[0].trigger('mouseenter')
      const dropdown = groupButtons[0].find('.absolute')
      expect(dropdown.exists()).toBe(true)
      const links = dropdown.findAll('a')
      const hrefs = links.map((l) => l.attributes('href'))
      expect(hrefs).toContain('/real-estate')
      expect(hrefs).toContain('/real-estate/apt-sale')
      expect(hrefs).toContain('/real-estate/villa-sale')
      expect(hrefs).toContain('/real-estate/offitel-sale')
    })

    it('청약·임대 드롭다운에 청약홈/LH 섹션 구분이 있어야 한다', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.md\\:flex [data-testid="nav-group"]')
      // 청약·임대 그룹 (두 번째, index 1)
      await groupButtons[1].trigger('mouseenter')
      const dropdown = groupButtons[1].find('.absolute')
      expect(dropdown.exists()).toBe(true)
      expect(dropdown.find('[data-testid="nav-section-divider"]').exists()).toBe(true)
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
      expect(hrefs).toContain('/clothes')
      expect(hrefs).toContain('/park')
    })

    it('should display group headers in mobile menu', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const text = mobileMenu.text()
      expect(text).toContain('생활/편의')
      expect(text).toContain('교육/육아')
      expect(text).toContain('건강/안전')
      expect(text).toContain('환경/생활')
    })

    it('모바일 메뉴에 생활시설 통합 섹션 헤더가 있어야 한다', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      expect(mobileMenu.text()).toContain('생활시설')
    })

    it('should have about link in mobile menu', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const links = mobileMenu.findAll('a')
      const hrefs = links.map((link) => link.attributes('href'))
      expect(hrefs).toContain('/about')
    })

    it('모바일 메뉴에서 부동산/청약 NAV 그룹이 유틸리티 링크보다 먼저 나와야 한다', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      const allLinks = mobileMenu.findAll('a')
      const hrefs = allLinks.map((link) => link.attributes('href'))

      const realEstateIndex = hrefs.indexOf('/real-estate/apt-sale')
      const aboutIndex = hrefs.indexOf('/about')
      expect(realEstateIndex).toBeGreaterThanOrEqual(0)
      expect(aboutIndex).toBeGreaterThanOrEqual(0)
      expect(realEstateIndex).toBeLessThan(aboutIndex)
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

    it('should have minimum 44px touch target for menu button', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      // size-11 = 44px (2.75rem)
      expect(menuButton.classes()).toContain('size-11')
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
