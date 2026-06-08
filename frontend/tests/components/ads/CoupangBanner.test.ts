import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CoupangBanner from '~/components/ads/CoupangBanner.vue'

describe('CoupangBanner', () => {
  it('renders Coupang Partners disclosure below the banner', () => {
    const wrapper = mount(CoupangBanner)

    expect(wrapper.text()).toContain(
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    )
  })

  it('links to the Coupang promotion deep link', () => {
    const wrapper = mount(CoupangBanner)
    const link = wrapper.find('a')

    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://link.coupang.com/a/epur2JvKIS')
  })

  it('opens the promotion in a new tab with affiliate-safe rel attributes', () => {
    const wrapper = mount(CoupangBanner)
    const link = wrapper.find('a')

    expect(link.attributes('target')).toBe('_blank')
    const rel = link.attributes('rel') ?? ''
    expect(rel).toContain('sponsored')
    expect(rel).toContain('nofollow')
    expect(rel).toContain('noopener')
  })

  it('renders the Coupang-supplied banner image with reserved dimensions', () => {
    const wrapper = mount(CoupangBanner)
    const img = wrapper.find('img')

    expect(img.exists()).toBe(true)
    // 런타임 sharp/IPX 미지원 서버 대응: /public/ads 의 사전최적화 webp를 정적 서빙
    expect(img.attributes('src')).toBe('/ads/coupang-samsung-festival.webp')
    expect(img.attributes('width')).toBe('1000')
    expect(img.attributes('height')).toBe('1000')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt') ?? '').not.toBe('')
  })
})
