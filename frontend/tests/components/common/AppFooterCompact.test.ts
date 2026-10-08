import { describe, it, expect, afterEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import AppFooter from '~/components/common/AppFooter.vue'

enableAutoUnmount(afterEach)

describe('AppFooter compact compatibility', () => {
  it('keeps all groups expanded in one column with reduced spacing', () => {
    const w = mount(AppFooter, { props: { compact: true } })
    const nav = w.get('[data-testid="footer-wide-navigation"]')
    expect(nav.classes()).toContain('grid-cols-1')
    expect(nav.classes()).not.toContain('md:grid-cols-4')
    expect(w.findAll('details')).toHaveLength(0)
    expect(w.find('[data-testid="footer-mobile-navigation"]').exists()).toBe(false)
    expect(w.classes()).toContain('py-5')
    expect(w.get('footer > div').classes()).toContain('px-4')
    expect(w.attributes('role')).toBe('contentinfo')
  })

  it('retains the same group links and metadata as the standard footer', () => {
    const base = mount(AppFooter)
    const compact = mount(AppFooter, { props: { compact: true } })
    for (const id of ['footer-wide-navigation', 'footer-meta']) {
      const links = (w: typeof base) => w.get(`[data-testid="${id}"]`).findAll('a')
        .map(a => [a.text(), a.attributes('href')])
      expect(links(compact)).toEqual(links(base))
    }
    expect(compact.get('[data-testid="footer-meta"]').text()).toBe(base.get('[data-testid="footer-meta"]').text())
    expect(base.get('[data-testid="footer-wide-navigation"]').classes()).toContain('md:grid-cols-4')
    expect(base.attributes('role')).toBeUndefined()
  })
})
