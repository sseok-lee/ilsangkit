import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HardLink from '~/components/common/HardLink.vue'

describe('HardLink', () => {
  it('renders a plain anchor for document navigation', () => {
    const wrapper = mount(HardLink, {
      props: { to: '/real-estate' },
      slots: { default: '부동산' },
    })

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/real-estate')
    expect(link.text()).toBe('부동산')
  })

  it('preserves inherited attributes and classes on the anchor', () => {
    const wrapper = mount(HardLink, {
      props: { to: '/hospital' },
      attrs: { class: 'cta-link', 'aria-label': '병원 찾기' },
      slots: { default: '병원' },
    })

    const link = wrapper.find('a')
    expect(link.classes()).toContain('cta-link')
    expect(link.attributes('aria-label')).toBe('병원 찾기')
  })
})
