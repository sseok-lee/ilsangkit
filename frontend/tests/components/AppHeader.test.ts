import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '~/components/common/AppHeader.vue'
import { SITE_BRAND_LINE } from '~/utils/seoConstants'

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
      const nav = wrapper.find('nav.hidden.lg\\:flex')
      expect(nav.exists()).toBe(true)
    })

    it('should display top-level nav buttons (부동산/청약·임대/생활시설)', () => {
      const nav = wrapper.find('nav.hidden.lg\\:flex')
      const text = nav.text()
      expect(text).toContain('부동산')
      expect(text).toContain('청약·임대')
      expect(text).toContain('생활시설')
    })

    it('should have a search input and an about link', () => {
      const nav = wrapper.find('nav.hidden.lg\\:flex')
      // 검색은 이제 링크가 아니라 HeaderSearch 입력창
      expect(wrapper.findComponent({ name: 'HeaderSearch' }).exists()).toBe(true)
      const hrefs = nav.findAll('a').map((link) => link.attributes('href'))
      expect(hrefs).toContain('/about')
    })

    it('생활시설 메가메뉴는 4개 그룹 열과 시설 카테고리 링크를 보여준다', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.lg\\:flex [data-testid="nav-group"]')
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

      // 아이콘 제거 후 텍스트-온리 항목은 font-medium으로 크리스프하게(밋밋함 방지)
      const megaLinks = mega.findAll('a')
      expect(megaLinks.length).toBeGreaterThan(0)
      expect(megaLinks.every((l) => l.classes().includes('font-medium'))).toBe(true)
    })

    it('should show 4 real estate links including hub in navigation', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.lg\\:flex [data-testid="nav-group"]')
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
      const groupButtons = wrapper.findAll('nav.hidden.lg\\:flex [data-testid="nav-group"]')
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
    it('should have mobile menu button hidden on desktop (lg:hidden cluster)', () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      expect(menuButton.exists()).toBe(true)
      // 메뉴 버튼은 검색+메뉴 모바일 클러스터(lg:hidden) 안에 있어 데스크톱에서 숨겨진다
      const cluster = menuButton.element.parentElement
      expect(cluster?.className).toContain('lg:hidden')
    })

    it('should have desktop navigation with hidden mobile class', () => {
      const desktopNav = wrapper.find('nav.hidden.lg\\:flex')
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

describe('부동산 드롭다운 SSR 크롤 경로(v-show, 상호작용 없음)', () => {
  // 하단 유형 카드를 제거한 뒤로 /real-estate/land 로 가는 내부 링크는 이 드롭다운 하나뿐이다
  // (tests/types/navGroups.test.ts 는 NAV_LINK_GROUPS 상수에 항목이 있는지만 본다 — 그 링크가
  // 실제로 SSR DOM에 렌더되는지, 즉 드롭다운이 v-show(항상 DOM에 존재·display:none)이지
  // v-if(상호작용 전엔 DOM에서 아예 빠짐)가 아닌지는 검증하지 않는다). mouseenter 를 먼저
  // 트리거하는 다른 테스트들은 v-show → v-if 로 바뀌어도 계속 통과하므로 이 속성을 못 잡는다.
  it('mouseenter 등 어떤 상호작용도 없이 렌더된 HTML에 /real-estate/land 링크가 존재한다', () => {
    const wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
        stubs: {
          NuxtLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
          // HardLink 는 스텁하지 않는다 — 실제 컴포넌트(<a :href="to">)를 그대로 써야
          // href 가 살아남는다. 이 파일의 다른 테스트들과 동일한 관례.
        },
      },
    })
    expect(wrapper.html()).toContain('href="/real-estate/land"')
  })
})

describe('데스크톱 GNB 텍스트-온리', () => {
  const REMOVED_GLYPHS = [
    'apartment', 'calendar_month', 'gavel', 'grid_view',
    'local_library', 'health_and_safety', 'home', 'eco', 'menu_book', 'info',
  ]

  const mountHeader = () =>
    mount(AppHeader, {
      global: {
        plugins: [router],
        stubs: {
          NuxtLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
          // tests/setup.ts의 전역 CategoryIcon 스텁은 name이 없어 findComponent({name})으로
          // 잡히지 않는다(src 없는 <img>만 남아 DOM 셀렉터도 우회됨). 이 describe에서만
          // name + 식별 가능한 data-testid를 가진 스텁으로 로컬 오버라이드해 부재를 검증한다.
          CategoryIcon: {
            name: 'CategoryIcon',
            props: ['categoryId', 'size'],
            template: '<div data-testid="category-icon-stub" />',
          },
        },
      },
    })

  it('데스크톱 nav에서 장식 material-symbols 아이콘을 제거한다(캐럿 expand_more만 유지)', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.lg\\:flex')
    const glyphs = nav.findAll('.material-symbols-outlined').map((s) => s.text().trim())
    for (const g of REMOVED_GLYPHS) expect(glyphs).not.toContain(g)
    // 캐럿은 유지 (탑레벨 트리거 4개)
    expect(glyphs.filter((g) => g === 'expand_more').length).toBe(4)
  })

  it('데스크톱 nav 메가패널에 카테고리 webp 아이콘(img)이 없다', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.lg\\:flex')
    expect(nav.findAll('img[src*="/icons/category/"]').length).toBe(0)
    // CategoryIcon 부재를 컴포넌트 트리로 직접 검증(위 로컬 오버라이드 스텁 사용).
    expect(nav.findAllComponents({ name: 'CategoryIcon' }).length).toBe(0)
    expect(nav.findAll('[data-testid="category-icon-stub"]').length).toBe(0)
  })

  it('사이트링크 보호: 데스크톱 nav leaf 앵커 수가 36개로 유지된다', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.lg\\:flex')
    expect(nav.findAll('a').length).toBe(36)
  })
})

describe('모바일 메뉴 텍스트-온리', () => {
  const mountHeader = () =>
    mount(AppHeader, {
      global: {
        plugins: [router],
        stubs: {
          NuxtLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
          // tests/setup.ts의 전역 CategoryIcon 스텁은 name이 없어 findAllComponents({name})으로
          // 잡히지 않는다(src 없는 <img>만 남아 DOM 셀렉터도 우회됨). 이 describe에서만
          // name + 식별 가능한 data-testid를 가진 스텁으로 로컬 오버라이드해 부재를 검증한다.
          CategoryIcon: {
            name: 'CategoryIcon',
            props: ['categoryId', 'size'],
            template: '<div data-testid="category-icon-stub" />',
          },
        },
      },
    })

  const openMobileMenu = async (wrapper: VueWrapper) => {
    await wrapper.find('button[aria-label="메뉴"]').trigger('click')
    return wrapper.find('[data-testid="mobile-menu"]')
  }

  it('모바일 메뉴에서 카테고리 아이콘(CategoryIcon/webp img)과 그룹 eyebrow 아이콘을 전부 제거한다', async () => {
    const wrapper = mountHeader()
    const menu = await openMobileMenu(wrapper)

    expect(menu.findAll('img[src*="/icons/category/"]').length).toBe(0)
    // CategoryIcon 부재를 컴포넌트 트리로 직접 검증(로컬 오버라이드 스텁 사용) — 나이브 DOM
    // img[src] 체크는 전역 스텁이 src 없는 <img>를 렌더해 부재를 위양성으로 통과시킨다.
    expect(menu.findAllComponents({ name: 'CategoryIcon' }).length).toBe(0)
    expect(menu.findAll('[data-testid="category-icon-stub"]').length).toBe(0)
    // 그룹 eyebrow(부동산/청약·임대/공매/생활시설) + leaf material-symbols 아이콘 전부 제거
    expect(menu.findAll('.material-symbols-outlined').length).toBe(0)
  })

  it('사이트링크 보호: 모바일 메뉴 링크 수가 40개로 유지된다', async () => {
    const wrapper = mountHeader()
    const menu = await openMobileMenu(wrapper)
    expect(menu.findAll('a').length).toBe(40)
  })

  it('그룹 간 여백이 mb-4로 확대되고 3단 위계(그룹 eyebrow→서브그룹→항목)를 유지한다', async () => {
    const wrapper = mountHeader()
    const menu = await openMobileMenu(wrapper)

    // NAV_LINK_GROUPS(3) + 생활시설(1) = 4개 그룹 래퍼
    const groupWrappers = menu.findAll('nav > div.mb-4')
    expect(groupWrappers.length).toBe(4)
    expect(menu.findAll('nav > div.mb-1').length).toBe(0)

    expect(menu.text()).toContain('부동산')
    expect(menu.text()).toContain('생활시설')
    expect(menu.text()).toContain('교육/육아')
  })

  it('leaf 링크가 min-h-[42px] 터치 타깃 + pl-6 들여쓰기를 유지하고 gap-3을 제거한다', async () => {
    const wrapper = mountHeader()
    const menu = await openMobileMenu(wrapper)

    const toiletLink = menu.findAll('a').find((a) => a.attributes('href') === '/toilet')
    expect(toiletLink).toBeTruthy()
    expect(toiletLink!.classes()).toContain('pl-6')
    expect(toiletLink!.classes()).toContain('min-h-[42px]')
    expect(toiletLink!.classes()).not.toContain('gap-3')

    const realEstateLink = menu.findAll('a').find((a) => a.attributes('href') === '/real-estate/apt-sale')
    expect(realEstateLink).toBeTruthy()
    expect(realEstateLink!.classes()).toContain('pl-6')
    expect(realEstateLink!.classes()).toContain('min-h-[42px]')
    expect(realEstateLink!.classes()).not.toContain('gap-3')
  })
})

describe('데스크톱 마이크로 라벨', () => {
  it('로고 옆에 브랜드 한 줄을 데스크톱 전용으로 렌더한다', () => {
    const wrapper = mount(AppHeader, {
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
    const label = wrapper
      .findAll('span')
      .find((s) => s.text() === SITE_BRAND_LINE)
    expect(label).toBeTruthy()
    // 데스크톱 전용(모바일 숨김)
    expect(label!.classes()).toContain('hidden')
    expect(label!.classes().some((c) => c.startsWith('lg:'))).toBe(true)
  })
})
