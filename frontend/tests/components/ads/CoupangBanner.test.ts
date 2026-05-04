import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CoupangBanner from '~/components/ads/CoupangBanner.vue'

function mountBanner() {
  vi.spyOn(document, 'querySelector').mockReturnValue(document.createElement('script'))

  return mount(CoupangBanner, {
    global: {
      stubs: {
        ClientOnly: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('CoupangBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Coupang Partners disclosure below the banner', () => {
    const wrapper = mountBanner()

    expect(wrapper.text()).toContain(
      '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
    )
  })

  it('reserves banner height to reduce layout shift', () => {
    const wrapper = mountBanner()

    const hasReservedHeight = wrapper
      .findAll('div')
      .some((element) => element.classes().includes('min-h-[140px]'))

    expect(hasReservedHeight).toBe(true)
  })
})
