import { describe, it, expect, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import BottomNavigation from '~/components/common/BottomNavigation.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'index', component: { template: '<div>Home</div>' } },
    { path: '/search', name: 'search', component: { template: '<div>Search</div>' } },
    { path: '/saved', name: 'saved', component: { template: '<div>Saved</div>' } },
    { path: '/profile', name: 'profile', component: { template: '<div>Profile</div>' } },
  ],
})

describe('BottomNavigation', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    await router.push('/')
    await router.isReady()

    wrapper = mount(BottomNavigation, {
      global: {
        plugins: [router],
        stubs: {
          NuxtLink: {
            template: '<a :href="to" :class="$attrs.class"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })
  })

  describe('Layout', () => {
    it('should render bottom navigation', () => {
      const nav = wrapper.find('nav')
      expect(nav.exists()).toBe(true)
    })

    it('should be sticky at bottom', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('sticky')
      expect(nav.classes()).toContain('bottom-0')
    })

    it('should have proper z-index', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('z-40')
    })

    it('should be hidden on desktop (md:hidden)', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('md:hidden')
    })
  })

  describe('Navigation Items', () => {
    it('should render 4 navigation items', () => {
      const items = wrapper.findAll('a, button')
      expect(items.length).toBe(4)
    })

    it('should have home tab with icon and label', () => {
      const homeTab = wrapper.find('a[href="/"]')
      expect(homeTab.exists()).toBe(true)
      expect(homeTab.text()).toContain('홈')
      expect(homeTab.find('.material-symbols-outlined').text()).toBe('home')
    })

    it('should have map tab with icon and label', () => {
      const mapTab = wrapper.find('a[href="/search"]')
      expect(mapTab.exists()).toBe(true)
      expect(mapTab.text()).toContain('지도')
      expect(mapTab.find('.material-symbols-outlined').text()).toBe('map')
    })

    it('should have saved tab with icon and label (disabled)', () => {
      const savedButton = wrapper.findAll('button').find(btn => btn.text().includes('저장'))
      expect(savedButton?.exists()).toBe(true)
      expect(savedButton?.attributes('disabled')).toBeDefined()
      expect(savedButton?.find('.material-symbols-outlined').text()).toBe('favorite')
    })

    it('should have profile tab with icon and label (disabled)', () => {
      const profileButton = wrapper.findAll('button').find(btn => btn.text().includes('내 정보'))
      expect(profileButton?.exists()).toBe(true)
      expect(profileButton?.attributes('disabled')).toBeDefined()
      expect(profileButton?.find('.material-symbols-outlined').text()).toBe('person')
    })
  })

  describe('Active State', () => {
    it('should highlight home tab when on home route', async () => {
      await router.push('/')
      await wrapper.vm.$nextTick()

      const homeTab = wrapper.find('a[href="/"]')
      expect(homeTab.classes()).toContain('text-primary')
    })

    it('should highlight map tab when on search route', async () => {
      await router.push('/search')
      await wrapper.vm.$nextTick()

      const mapTab = wrapper.find('a[href="/search"]')
      expect(mapTab.classes()).toContain('text-primary')
    })

    it('should apply inactive styles to non-active tabs', async () => {
      await router.push('/')
      await wrapper.vm.$nextTick()

      const mapTab = wrapper.find('a[href="/search"]')
      expect(mapTab.classes()).toContain('text-slate-400')
    })

    it('should apply fill-1 class to active tab icon', async () => {
      await router.push('/')
      await wrapper.vm.$nextTick()

      const homeIcon = wrapper.find('a[href="/"] .material-symbols-outlined')
      expect(homeIcon.classes()).toContain('fill-1')
    })
  })

  describe('Styling', () => {
    it('should have white background with dark mode support', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('bg-white')
      expect(nav.classes()).toContain('dark:bg-[#1e293b]')
    })

    it('should have border at top', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('border-t')
      expect(nav.classes()).toContain('border-slate-100')
      expect(nav.classes()).toContain('dark:border-slate-800')
    })

    it('should have proper height and padding', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('h-[80px]')
      expect(nav.classes()).toContain('pt-2')
      expect(nav.classes()).toContain('px-6')
      expect(nav.classes()).toContain('pb-6')
    })
  })

  describe('Safe Area Support', () => {
    it('should render navigation element for safe area', () => {
      // Safe area inset is applied via inline style
      // This is a visual feature that requires real device testing
      const nav = wrapper.find('nav')
      expect(nav.exists()).toBe(true)
      expect(nav.classes()).toContain('pb-6')
    })
  })

  describe('Accessibility', () => {
    it('should have aria-label for disabled tabs', () => {
      const savedButton = wrapper.findAll('button').find(btn => btn.text().includes('저장'))
      const profileButton = wrapper.findAll('button').find(btn => btn.text().includes('내 정보'))

      expect(savedButton?.attributes('aria-label')).toBe('저장 (준비 중)')
      expect(profileButton?.attributes('aria-label')).toBe('내 정보 (준비 중)')
    })

    it('should disable future navigation items', () => {
      const savedButton = wrapper.findAll('button').find(btn => btn.text().includes('저장'))
      const profileButton = wrapper.findAll('button').find(btn => btn.text().includes('내 정보'))

      expect(savedButton?.attributes('disabled')).toBeDefined()
      expect(profileButton?.attributes('disabled')).toBeDefined()
    })
  })

  describe('Responsive Design', () => {
    it('should use flexbox for layout', () => {
      const nav = wrapper.find('nav')
      expect(nav.classes()).toContain('flex')
      expect(nav.classes()).toContain('justify-between')
      expect(nav.classes()).toContain('items-end')
    })

    it('should have fixed width for each tab', () => {
      const tabs = wrapper.findAll('.w-12')
      expect(tabs.length).toBe(4)
    })
  })
})
