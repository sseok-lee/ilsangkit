import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AdBanner from '~/components/ads/AdBanner.vue'

const clientOnlyStub = {
  template: '<slot />',
}

async function flushAdMount() {
  await nextTick()
  await nextTick()
}

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const sourcePath = resolve(frontendRoot, 'components/ads/AdBanner.vue')
const source = () => readFileSync(sourcePath, 'utf8')
const requestSourcePath = resolve(frontendRoot, 'components/ads/useDeferredAdSenseRequest.ts')
const requestSource = () => readFileSync(requestSourcePath, 'utf8')

describe('AdBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists the AdSense queue on window before pushing the manual slot request', () => {
    expect(requestSource()).toContain('win.adsbygoogle = win.adsbygoogle || []')
    expect(requestSource()).toContain('win.adsbygoogle.push({})')
  })

  it('pushes the ad request immediately on mount without lazy/IntersectionObserver gating', () => {
    expect(source()).toContain('useDeferredAdSenseRequest(container)')
    expect(requestSource()).toContain('hasRequestedAd.value = true')
    expect(requestSource()).toContain('onBeforeUnmount(clearPendingAdRequest)')
    expect(requestSource()).not.toContain('IntersectionObserver')
    expect(requestSource()).not.toContain('AD_REQUEST_DELAY_MS')
    expect(requestSource()).not.toContain('AD_REQUEST_ROOT_MARGIN')
    expect(requestSource()).not.toContain('requestAnimationFrame')
  })

  it('does not fabricate data-ad-status=unfilled when AdSense has not responded yet', async () => {
    const wrapper = mount(AdBanner, {
      global: {
        stubs: { ClientOnly: clientOnlyStub },
      },
    })

    await flushAdMount()
    vi.advanceTimersByTime(6000)
    await nextTick()

    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-status')).toBeUndefined()
    expect(source()).not.toContain("setAttribute('data-ad-status', 'unfilled')")
  })

  it('collapses the parent container after timeout when AdSense never sets data-ad-status', async () => {
    const wrapper = mount(AdBanner, {
      global: {
        stubs: { ClientOnly: clientOnlyStub },
      },
    })

    await flushAdMount()
    // timeout 발동 전에는 부모에 timed-out 클래스가 없어야 한다
    expect(wrapper.classes()).not.toContain('ad-banner--timed-out')

    // 4s timeout 진행 (실패에 안전한 마진 포함)
    vi.advanceTimersByTime(5000)
    await nextTick()
    await nextTick()

    // status 가 끝내 설정되지 않은 경우 부모가 collapse 되도록 클래스 추가
    expect(wrapper.classes()).toContain('ad-banner--timed-out')
    // ins 자체의 data-ad-status 는 여전히 우리가 조작하지 않는다
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-status')).toBeUndefined()
  })

  it('does not collapse the parent when AdSense sets data-ad-status before timeout', async () => {
    const wrapper = mount(AdBanner, {
      global: {
        stubs: { ClientOnly: clientOnlyStub },
      },
    })

    await flushAdMount()
    // AdSense 가 timeout 전에 status 를 설정한 상황을 시뮬레이션 (filled, unfilled 등)
    wrapper.get('ins.adsbygoogle').element.setAttribute('data-ad-status', 'filled')

    vi.advanceTimersByTime(5000)
    await nextTick()
    await nextTick()

    expect(wrapper.classes()).not.toContain('ad-banner--timed-out')
  })

  it('keeps the default manual slot attributes configurable through props', () => {
    const wrapper = mount(AdBanner, {
      props: {
        adSlot: '9999999999',
        adFormat: 'horizontal',
        fullWidthResponsive: 'false',
      },
      global: {
        stubs: { ClientOnly: clientOnlyStub },
      },
    })

    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('data-ad-client')).toBe('ca-pub-2088264360250020')
    expect(ins.attributes('data-ad-slot')).toBe('9999999999')
    expect(ins.attributes('data-ad-format')).toBe('horizontal')
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
  })
})
