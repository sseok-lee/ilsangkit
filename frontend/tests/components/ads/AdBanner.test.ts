import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, onMounted, ref } from 'vue'
import AdBanner, { AD_SLOT_MOBILE, AD_SLOT_DESKTOP } from '~/components/ads/AdBanner.vue'

const clientOnlyStub = {
  template: '<slot />',
}

// 실제 Nuxt <ClientOnly> 처럼, mount 직후 한 틱 뒤에야 slot(=<ins>)을 DOM 에 삽입한다.
// 동기 렌더 stub('<slot/>')은 ins 가 onMounted 시점에 이미 존재해 production 의
// 타이밍 레이스를 가린다. watchStatus 가 onMounted 에서 동기로 ins 를 못 찾고 bail 하면
// 4s collapse 타이머가 영영 설치되지 않는 회귀를 이 stub 으로 재현한다.
const deferredClientOnlyStub = defineComponent({
  setup(_, { slots }) {
    const show = ref(false)
    onMounted(() => {
      void nextTick(() => {
        show.value = true
      })
    })
    return () => (show.value ? slots.default?.() : null)
  },
})

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

  it('ins 가 한 틱 늦게(ClientOnly) 삽입돼도 status 미설정 시 timeout 으로 collapse 한다', async () => {
    const wrapper = mount(AdBanner, {
      global: {
        stubs: { ClientOnly: deferredClientOnlyStub },
      },
    })

    // ClientOnly 가 ins 를 다음 틱에 삽입 — 충분히 flush 해서 ins 존재를 확인.
    await nextTick()
    await nextTick()
    await nextTick()
    expect(wrapper.find('ins.adsbygoogle').exists()).toBe(true)

    // 4s timeout 진행. status 가 끝내 안 잡힌 슬롯은 부모가 collapse 돼야 한다.
    vi.advanceTimersByTime(5000)
    await nextTick()
    await nextTick()

    expect(wrapper.classes()).toContain('ad-banner--timed-out')
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


  // ── 기기별 광고 단위 분리 (AdSense: ilsangkit-mobile / ilsangkit-desktop) ──
  // 단위가 하나면 AdSense 가 기기별로 최적화·리포팅을 못 한다. 실측상 데스크톱 In-page
  // 채움률 76.1% / RPM 0.165 vs 모바일 93.7% / 0.413 로 격차가 커 기기부터 분리한다.
  function stubViewport(isDesktop: boolean) {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: isDesktop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  }

  it('모바일 뷰포트에서는 모바일 광고 단위를 요청한다', async () => {
    stubViewport(false)
    const wrapper = mount(AdBanner, { global: { stubs: { ClientOnly: clientOnlyStub } } })
    await flushAdMount()
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-slot')).toBe(AD_SLOT_MOBILE)
  })

  it('데스크톱 뷰포트에서는 데스크톱 광고 단위를 요청한다', async () => {
    stubViewport(true)
    const wrapper = mount(AdBanner, { global: { stubs: { ClientOnly: clientOnlyStub } } })
    await flushAdMount()
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-slot')).toBe(AD_SLOT_DESKTOP)
  })

  it('variant/only 없는 기본 AdBanner 도 기기를 판정한다 (mq 초기화 회귀)', async () => {
    // 회귀: mq 생성이 `props.only || variant === 'compact-mobile'` 안에만 있으면
    // 기본 AdBanner 는 isDesktopViewport 가 false 로 고정돼 데스크톱에서도 모바일 슬롯을 받는다.
    stubViewport(true)
    const wrapper = mount(AdBanner, { global: { stubs: { ClientOnly: clientOnlyStub } } })
    await flushAdMount()
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-slot')).toBe(AD_SLOT_DESKTOP)
  })

  it('compact-mobile variant 도 기기별 단위를 따른다', async () => {
    stubViewport(false)
    const wrapper = mount(AdBanner, {
      props: { variant: 'compact-mobile' },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-slot')).toBe(AD_SLOT_MOBILE)
  })

  it('adSlot prop 을 명시하면 기기 분리보다 우선한다', async () => {
    stubViewport(true)
    const wrapper = mount(AdBanner, {
      props: { adSlot: '1234567890' },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    expect(wrapper.get('ins.adsbygoogle').attributes('data-ad-slot')).toBe('1234567890')
  })

  it('두 단위 ID 가 서로 다르고 legacy 단위를 쓰지 않는다', () => {
    const LEGACY = '1878068382' // ilsangkit-display — 계정엔 남기되(과거 리포트 보존) 코드는 안 쓴다
    expect(AD_SLOT_MOBILE).not.toBe(AD_SLOT_DESKTOP)
    expect(AD_SLOT_MOBILE).not.toBe(LEGACY)
    expect(AD_SLOT_DESKTOP).not.toBe(LEGACY)
    // prop 기본값으로 legacy 가 되살아나면 기기 분리가 통째로 무력화된다.
    expect(source()).not.toMatch(/adSlot:\s*['"]\d+['"]/)
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

  describe('status 타임아웃 = 1500ms', () => {
    it('1500ms 경과 시 timed-out collapse (status 미응답)', async () => {
      const wrapper = mount(AdBanner, {
        global: {
          stubs: { ClientOnly: clientOnlyStub },
        },
      })

      await flushAdMount()
      // status 미설정 상태에서 1500ms 직전에는 collapse 아님
      vi.advanceTimersByTime(1400)
      await nextTick()
      expect(wrapper.classes()).not.toContain('ad-banner--timed-out')

      // 1500ms 도달 시 collapse
      vi.advanceTimersByTime(200)
      await nextTick()
      expect(wrapper.classes()).toContain('ad-banner--timed-out')
    })
  })

  describe('신뢰 디자인: "광고" 라벨 + 점선 테두리 + surface-2 배경', () => {
    it('"광고" 라벨을 .ad-banner 내부에 렌더한다', async () => {
      const wrapper = mount(AdBanner, {
        global: { stubs: { ClientOnly: clientOnlyStub } },
      })
      await flushAdMount()

      const banner = wrapper.find('.ad-banner')
      expect(banner.exists()).toBe(true)
      const label = banner.find('.ad-banner__label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('광고')
    })

    it('라벨은 .ad-banner의 자식이라 collapse 시 부모와 함께 숨겨진다 (독립 최상위 요소가 아니다)', async () => {
      const wrapper = mount(AdBanner, {
        global: { stubs: { ClientOnly: clientOnlyStub } },
      })
      await flushAdMount()

      // 라벨이 .ad-banner 밖 형제로 새면 collapse(부모 display:none)를 안 타 유령 라벨이 됨
      expect(wrapper.find('.ad-banner > .ad-banner__label').exists()).toBe(true)
    })

    it('min-height는 CLS 보존을 위해 라벨+테두리(22px)만큼 상향된 값을 유지한다', () => {
      const src = source()
      expect(src).toContain('.ad-banner--auto { min-height: 122px;')
      expect(src).toContain('min-height: 302px;')   // 모바일 auto
      expect(src).toContain('.ad-banner--horizontal { min-height: 112px;')
      expect(src).toContain('.ad-banner--rectangle { min-height: 272px;')
      expect(src).toContain('.ad-banner--compact-mobile { min-height: 170px;')
    })
  })
})
