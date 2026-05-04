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

  it('renders the Coupang widget iframe with the configured tracking code', () => {
    const wrapper = mount(CoupangBanner)
    const iframe = wrapper.find('iframe')

    expect(iframe.exists()).toBe(true)
    const src = iframe.attributes('src') ?? ''
    expect(src).toContain('ads-partners.coupang.com/widgets.html')
    expect(src).toContain('id=985751')
    expect(src).toContain('trackingCode=AF5459655')
  })

  it('reserves banner height to reduce layout shift', () => {
    const wrapper = mount(CoupangBanner)
    const iframe = wrapper.find('iframe')

    expect(iframe.attributes('height')).toBe('140')
  })
})
