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

  it('renders action buttons in order with primary highlighted', () => {
    const wrapper = mount(PageHero, {
      props: {
        title: '온누리약국 종로점',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵으로 길찾기', href: 'https://map.kakao.com/x' },
            { label: '네이버맵으로 길찾기', href: 'https://map.naver.com/x' },
          ] },
          { type: 'phone', label: '전화', href: 'tel:0212345678' },
          { type: 'share', label: '공유' },
        ],
      },
    })
    const buttons = wrapper.findAll('[data-test="hero-action"]')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].text()).toContain('길찾기')
    expect(buttons[0].classes()).toContain('bg-primary')
    expect(buttons[1].attributes('href')).toBe('tel:0212345678')
    expect(buttons[2].element.tagName).toBe('BUTTON')   // href·menu 모두 없으면 button
  })

  it('toggles menu dropdown when an action with menu is clicked', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵', href: 'https://k.example' },
            { label: '네이버맵', href: 'https://n.example' },
          ] },
        ],
      },
    })
    expect(wrapper.find('[data-test="hero-action-menu"]').exists()).toBe(false)
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    const menu = wrapper.find('[data-test="hero-action-menu"]')
    expect(menu.exists()).toBe(true)
    const items = menu.findAll('a')
    expect(items).toHaveLength(2)
    expect(items[0].attributes('href')).toBe('https://k.example')
    expect(items[0].text()).toContain('카카오맵')
  })

  it('closes menu dropdown when trigger is clicked again', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵', href: 'https://k.example' },
            { label: '네이버맵', href: 'https://n.example' },
          ] },
        ],
      },
    })
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    expect(wrapper.find('[data-test="hero-action-menu"]').exists()).toBe(true)
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    expect(wrapper.find('[data-test="hero-action-menu"]').exists()).toBe(false)
  })

  it('emits share event when share action without href or menu is clicked', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [{ type: 'share', label: '공유' }],
      },
    })
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
    expect(wrapper.emitted('action')![0]).toEqual([{ type: 'share' }])
  })

  it('does not render action row when actions is empty', () => {
    const wrapper = mount(PageHero, { props: { title: 'X' } })
    expect(wrapper.find('[data-test="hero-actions"]').exists()).toBe(false)
  })

  it('emits action-menu-select when a menu item is clicked', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵', href: 'https://k.example' },
            { label: '네이버맵', href: 'https://n.example' },
          ] },
        ],
      },
    })
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    const items = wrapper.find('[data-test="hero-action-menu"]').findAll('a')
    await items[0].trigger('click')
    const events = wrapper.emitted('action-menu-select')
    expect(events).toBeTruthy()
    expect(events![0][0]).toMatchObject({
      type: 'directions',
      item: { label: '카카오맵', href: 'https://k.example' },
    })
  })
})
