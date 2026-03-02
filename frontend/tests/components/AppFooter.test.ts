import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from '~/components/common/AppFooter.vue'
import { CATEGORY_META } from '~/types/facility'

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
      expect(wrapper.classes()).toContain('py-6')
    })
  })

  describe('Public Data Attribution', () => {
    it('should display public data source text', () => {
      const wrapper = mount(AppFooter)

      expect(wrapper.text()).toContain('공공데이터포털(data.go.kr)')
      expect(wrapper.text()).toContain('공공누리 제1유형')
    })

    it('should have hyperlink to data.go.kr', () => {
      const wrapper = mount(AppFooter)

      const link = wrapper.find('a[href="https://www.data.go.kr"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
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

describe('AppFooter - Internal links', () => {
  const mountFooter = () =>
    mount(AppFooter, {
      global: {
        stubs: {
          NuxtLink: {
            template: '<a :href="to"><slot /></a>',
            props: ['to'],
          },
        },
      },
    })

  it('should render all 10 category links', () => {
    const wrapper = mountFooter()
    const categories: (keyof typeof CATEGORY_META)[] = [
      'toilet', 'wifi', 'parking', 'kiosk',
      'hospital', 'pharmacy', 'aed',
      'library', 'clothes', 'trash',
    ]
    for (const category of categories) {
      const link = wrapper.find(`a[href="/${category}"]`)
      expect(link.exists(), `link for /${category} should exist`).toBe(true)
    }
  })

  it('should render category link text matching CATEGORY_META label', () => {
    const wrapper = mountFooter()
    const categories = Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]
    for (const category of categories) {
      const link = wrapper.find(`a[href="/${category}"]`)
      expect(link.exists()).toBe(true)
      expect(link.text()).toBe(CATEGORY_META[category].label)
    }
  })

  it('should have at least 3 major city links (서울, 부산, 인천)', () => {
    const wrapper = mountFooter()
    const citySlugs = ['seoul', 'busan', 'incheon']
    for (const slug of citySlugs) {
      const link = wrapper.find(`a[href="/${slug}"]`)
      expect(link.exists(), `city link for /${slug} should exist`).toBe(true)
    }
  })

  it('should keep existing /about, /privacy, /terms, /contact links', () => {
    const wrapper = mountFooter()
    for (const path of ['/about', '/privacy', '/terms', '/contact']) {
      const link = wrapper.find(`a[href="${path}"]`)
      expect(link.exists(), `link for ${path} should exist`).toBe(true)
    }
  })

  it('should render footer-categories section', () => {
    const wrapper = mountFooter()
    expect(wrapper.find('[data-testid="footer-categories"]').exists()).toBe(true)
  })

  it('should render footer-regions section', () => {
    const wrapper = mountFooter()
    expect(wrapper.find('[data-testid="footer-regions"]').exists()).toBe(true)
  })
})
