import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHero from '~/components/common/PageHero.vue'

describe('PageHero', () => {
  it('renders badge slot next to title when provided', () => {
    const wrapper = mount(PageHero, {
      props: { title: '온누리약국 종로점', eyebrow: '약국' },
      slots: { badge: '<span data-test="badge">영업중</span>' },
    })
    const badge = wrapper.find('[data-test="badge"]')
    expect(badge.exists()).toBe(true)
    // 배지는 H1 컨테이너 안에 있어야 한다(같은 줄 정렬용).
    expect(wrapper.find('h1').element.contains(badge.element)).toBe(true)
  })

  it('omits badge container when slot is empty', () => {
    const wrapper = mount(PageHero, {
      props: { title: '온누리약국 종로점' },
    })
    expect(wrapper.find('[data-test="badge-wrap"]').exists()).toBe(false)
  })
})
