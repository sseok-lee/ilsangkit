import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AnchorAdBanner from '~/components/ads/AnchorAdBanner.vue'

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
const sourcePath = resolve(frontendRoot, 'components/ads/AnchorAdBanner.vue')
const source = () => readFileSync(sourcePath, 'utf8')
const requestSourcePath = resolve(frontendRoot, 'components/ads/useDeferredAdSenseRequest.ts')
const requestSource = () => readFileSync(requestSourcePath, 'utf8')

describe('AnchorAdBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    delete (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle
  })

  afterEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
    delete (window as Window & { adsbygoogle?: unknown[] }).adsbygoogle
  })

  it('persists the AdSense queue on window before pushing the anchor slot request', () => {
    expect(requestSource()).toContain('win.adsbygoogle = win.adsbygoogle || []')
    expect(requestSource()).toContain('win.adsbygoogle.push({})')
  })

  it('waits for layout stability and near-viewport visibility before requesting an ad', () => {
    expect(source()).toContain('useDeferredAdSenseRequest(')
    expect(requestSource()).toContain('export const AD_REQUEST_DELAY_MS = 500')
    expect(requestSource()).toContain('IntersectionObserver')
    expect(requestSource()).toContain('rootMargin: AD_REQUEST_ROOT_MARGIN')
    expect(requestSource()).toContain('requestAnimationFrame')
    expect(requestSource()).toContain('hasRequestedAd.value = true')
    expect(requestSource()).toContain('onBeforeUnmount(clearPendingAdRequest)')
  })

  it('does not fabricate data-ad-status=unfilled when AdSense has not responded yet', async () => {
    const wrapper = mount(AnchorAdBanner, {
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

  it('renders a horizontal manual anchor slot with reserved height', () => {
    const wrapper = mount(AnchorAdBanner, {
      global: {
        stubs: { ClientOnly: clientOnlyStub },
      },
    })

    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('data-ad-client')).toBe('ca-pub-2088264360250020')
    expect(ins.attributes('data-ad-slot')).toBe('1878068382')
    expect(ins.attributes('data-ad-format')).toBe('horizontal')
    expect(ins.attributes('style')).toContain('height: 100px')
  })
})
