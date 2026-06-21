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
    vi.unstubAllGlobals()
    delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle
    ;(globalThis as any).__resetUseState?.()
  })

  it('persists the AdSense queue on window before pushing the manual slot request', () => {
    expect(requestSource()).toContain('win.adsbygoogle = win.adsbygoogle || []')
    expect(requestSource()).toContain('win.adsbygoogle.push({})')
  })

  it('pushes the ad request immediately on mount without lazy/IntersectionObserver gating', () => {
    expect(source()).toContain('useDeferredAdSenseRequest(container, () => shouldServeAds.value)')
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

  it('타임아웃으로 collapse 된 뒤에도 AdSense 가 늦게 filled 하면 다시 노출한다 (recoverable collapse)', async () => {
    const wrapper = mount(AdBanner, {
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()

    // status 가 끝내 안 잡혀 4s timeout 으로 일단 collapse
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(wrapper.classes()).toContain('ad-banner--timed-out')

    // 4s 이후 AdSense 가 뒤늦게 filled → collapse 가 복구되어 다시 노출되어야 한다
    wrapper.get('ins.adsbygoogle').element.setAttribute('data-ad-status', 'filled')
    await nextTick()
    await nextTick()
    await nextTick()

    expect(wrapper.classes()).not.toContain('ad-banner--timed-out')
  })

  it('unfilled 가 늦게 와도 collapse 상태를 유지한다', async () => {
    const wrapper = mount(AdBanner, {
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(wrapper.classes()).toContain('ad-banner--timed-out')

    wrapper.get('ins.adsbygoogle').element.setAttribute('data-ad-status', 'unfilled')
    await nextTick()
    await nextTick()

    // filled 가 아니므로 복구되지 않고 collapse 유지 (CSS 가 unfilled 도 collapse)
    expect(wrapper.classes()).toContain('ad-banner--timed-out')
  })

  // 런타임 push 경로는 import.meta.client 게이트라 unit 환경(undefined)에서 실행되지 않으므로,
  // 이 모듈의 기존 테스트(39-47행)와 동일하게 소스 구조로 재시도 메커니즘을 보증한다.
  it('zero-width 컨테이너에서 push 를 포기하지 않고 ResizeObserver 로 재시도한다', () => {
    const src = requestSource()
    // 0폭이면 그냥 return 하지 않고 폭이 잡힐 때까지 재시도를 예약
    expect(src).toMatch(/offsetWidth === 0[\s\S]*scheduleResizeRetry/)
    expect(src).toContain('new ResizeObserver(')
    // 폭이 생기면 pushAd 재시도
    expect(src).toMatch(/offsetWidth > 0[\s\S]*pushAd\(generation\)/)
    // 언마운트/세대 변경 시 observer 정리
    expect(src).toContain('teardownResizeRetry')
    expect(src).toContain('resizeObserver.disconnect()')
    // 기존 lazy/지연 게이팅 회귀 금지
    expect(src).not.toContain('IntersectionObserver')
    expect(src).not.toContain('requestAnimationFrame')
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

  it('sizing="fixed"일 때 ins에 명시 높이와 data-full-width-responsive=false가 적용된다', async () => {
    const wrapper = mount(AdBanner, {
      props: { sizing: 'fixed', adFormat: 'rectangle', fixedHeight: 280 },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('style')).toMatch(/height:\s*280px/)
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
    expect(ins.attributes('data-ad-format')).toBe('rectangle')
  })

  it('sizing 미지정 시 기존 동작(auto + full-width-responsive=true)을 유지한다', async () => {
    const wrapper = mount(AdBanner, {
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('data-ad-format')).toBe('auto')
    expect(ins.attributes('data-full-width-responsive')).toBe('true')
    expect(ins.attributes('style') || '').not.toMatch(/height:\s*\d/)
  })

  it('compact-mobile variant는 모바일용 150px 고정 슬롯을 중앙 정렬한다', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const wrapper = mount(AdBanner, {
      props: { variant: 'compact-mobile' },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()

    expect(wrapper.classes()).toContain('ad-banner--compact-mobile')
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('style')).toMatch(/display:\s*inline-block/)
    expect(ins.attributes('style')).toMatch(/width:\s*100%/)
    expect(ins.attributes('style')).toMatch(/max-width:\s*336px/)
    expect(ins.attributes('style')).toMatch(/height:\s*150px/)
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
    expect(ins.attributes('data-ad-format')).toBe('horizontal')
  })

  it('compact-mobile variant도 데스크톱 뷰포트에서는 기존 auto 슬롯으로 동작한다', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    const wrapper = mount(AdBanner, {
      props: { variant: 'compact-mobile' },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()

    expect(wrapper.classes()).not.toContain('ad-banner--compact-mobile')
    expect(wrapper.classes()).toContain('ad-banner--auto')
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('data-ad-format')).toBe('auto')
    expect(ins.attributes('data-full-width-responsive')).toBe('true')
    expect(ins.attributes('style') || '').not.toMatch(/height:\s*150px/)
  })

  it('라우트 변경 재요청에 rapid-nav 스로틀 가드가 있다', () => {
    expect(source()).toContain('MIN_NAV_INTERVAL_MS')
    expect(source()).toMatch(/route\.path[\s\S]*MIN_NAV_INTERVAL_MS/)
  })

  it('ads:suppressed=true면 광고를 렌더하지 않는다', async () => {
    ;(globalThis as any).useState('ads:suppressed', () => false).value = true
    const wrapper = mount(AdBanner, { global: { stubs: { ClientOnly: clientOnlyStub } } })
    await flushAdMount()
    expect(wrapper.find('ins.adsbygoogle').exists()).toBe(false)
  })
})
