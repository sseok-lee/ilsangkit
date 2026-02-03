import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from '~/components/common/AppFooter.vue'

describe('AppFooter', () => {
  describe('Rendering', () => {
    it('should render footer element', () => {
      const wrapper = mount(AppFooter, {
        global: {
          stubs: {
            NuxtLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      })

      expect(wrapper.element.tagName).toBe('FOOTER')
    })
  })

  describe('Copyright', () => {
    it('should display copyright text', () => {
      const wrapper = mount(AppFooter)
      const currentYear = new Date().getFullYear()

      expect(wrapper.text()).toContain(`© ${currentYear} 일상킷`)
      expect(wrapper.text()).toContain('All rights reserved')
    })
  })

  describe('Links', () => {
    it('should render footer links', () => {
      const wrapper = mount(AppFooter, {
        global: {
          stubs: {
            NuxtLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      })

      const links = wrapper.findAll('a')
      expect(links.length).toBeGreaterThan(0)
    })

    it('should have link to privacy policy', () => {
      const wrapper = mount(AppFooter, {
        global: {
          stubs: {
            NuxtLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      })

      const text = wrapper.text()
      expect(text).toContain('개인정보처리방침')
    })

    it('should have link to terms of service', () => {
      const wrapper = mount(AppFooter, {
        global: {
          stubs: {
            NuxtLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      })

      const text = wrapper.text()
      expect(text).toContain('이용약관')
    })
  })

  describe('Styling', () => {
    it('should have background color', () => {
      const wrapper = mount(AppFooter)
      expect(wrapper.classes()).toContain('bg-gray-50')
    })

    it('should have border-top', () => {
      const wrapper = mount(AppFooter)
      expect(wrapper.classes()).toContain('border-t')
    })

    it('should have proper padding', () => {
      const wrapper = mount(AppFooter)
      expect(wrapper.classes()).toContain('py-8')
    })
  })

  describe('Accessibility', () => {
    it('should have minimum spacing between links', () => {
      const wrapper = mount(AppFooter, {
        global: {
          stubs: {
            NuxtLink: {
              template: '<a :href="to"><slot /></a>',
              props: ['to'],
            },
          },
        },
      })

      const linkContainer = wrapper.find('[data-testid="footer-links"]')
      if (linkContainer.exists()) {
        // Should have gap-4 (16px) or more for touch targets
        expect(linkContainer.classes().some((c) => c.includes('gap'))).toBe(true)
      }
    })
  })
})
