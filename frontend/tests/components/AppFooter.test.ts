import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
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

    it('should have link to real estate hub', () => {
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
      const hrefs = links.map((l) => l.attributes('href'))
      expect(hrefs).toContain('/real-estate')
    })

    it('should have link to subscription hub', () => {
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
      const hrefs = links.map((l) => l.attributes('href'))
      expect(hrefs).toContain('/subscription')
    })

  })

  describe('Styling', () => {
    it('should have background color', () => {
      const wrapper = mount(AppFooter)
      expect(wrapper.classes()).toContain('bg-background-light')
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
      expect(wrapper.text()).toContain('국토교통부 실거래가 공개시스템')
      expect(wrapper.text()).toContain('공공누리(KOGL)')
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

  describe('AppFooter — 운영 실체 블록', () => {
    it('운영 주체·문의 이메일·수정 요청 링크를 렌더한다', () => {
      const w = mount(AppFooter)
      expect(w.text()).toContain('일상킷 팀')
      const mailto = w.find('a[href="mailto:contact@ilsangkit.co.kr"]')
      expect(mailto.exists()).toBe(true)
      expect(w.text()).toContain('정보 수정 요청')
      expect(w.text()).toContain('확인 후 3~5일 내 반영')
    })

    it('면책 문구를 렌더한다', () => {
      const w = mount(AppFooter)
      expect(w.text()).toContain('가공한 참고용 정보입니다')
    })

    it('동기화 데이터가 없으면 "데이터 최종 동기화" 행을 렌더하지 않는다', () => {
      const w = mount(AppFooter) // 전역 useAsyncData mock은 null 데이터
      expect(w.text()).not.toContain('데이터 최종 동기화')
    })

    describe('신선한 동기화 데이터가 있는 경우', () => {
      afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
      })

      it('"데이터 최종 동기화" 행을 날짜와 함께 렌더한다', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'))

        // 전역 useAsyncData mock(null 고정)을 이 테스트에서만 override
        vi.stubGlobal('useAsyncData', () => ({
          data: ref({ pharmacy: '2026-07-11T06:00:00.000Z' }),
        }))

        const w = mount(AppFooter)
        expect(w.text()).toContain('데이터 최종 동기화')
        expect(w.text()).toContain('2026.07.11 15:00')
      })
    })
  })
})
