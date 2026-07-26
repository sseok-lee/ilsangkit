import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

// 뷰어빌리티 게이트: 슬롯이 뷰포트에 근접(rootMargin)했을 때만 광고를 요청한다.
// 무스크롤 바운스에서 화면 밖 슬롯까지 즉시 impression 을 만들어 unviewable 비율을
// 끌어올리던 문제(AdSense 무효트래픽 반복 재발의 근본원인)를 막는다.
// 폴드 상단 슬롯은 로드 시 이미 교차하므로 즉시 발화(=정상 뷰어블),
// 폴드 아래 슬롯만 사용자가 근접했을 때 발화한다(경쟁사에서 검증된 lazy 패턴).
// 값은 채움률/뷰어빌리티 균형점 — AdSense 리포트로 조정 가능.
const VIEWABILITY_ROOT_MARGIN = '200px 0px'

export function useDeferredAdSenseRequest(
  container: Ref<HTMLElement | null>,
  canRequest: () => boolean = () => true,
) {
  const hasRequestedAd = ref(false)
  let requestGeneration = 0
  let resizeObserver: ResizeObserver | null = null
  let viewabilityObserver: IntersectionObserver | null = null

  function teardownResizeRetry() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  function teardownViewabilityGate() {
    if (viewabilityObserver) {
      viewabilityObserver.disconnect()
      viewabilityObserver = null
    }
  }

  function clearPendingAdRequest() {
    requestGeneration++
    teardownResizeRetry()
    teardownViewabilityGate()
  }

  // 컨테이너가 아직 0폭(레이아웃 미완료/cross-viewport hidden 등)이면 push 를 그냥
  // 포기하지 말고, 폭이 잡히는 순간 재시도한다. 단발 push 가 layout 타이밍을 놓쳐
  // 슬롯이 영영 미요청(unset)으로 남는 회귀를 방지.
  function scheduleResizeRetry(generation: number, el: HTMLElement) {
    if (typeof ResizeObserver === 'undefined') return
    teardownResizeRetry()
    resizeObserver = new ResizeObserver(() => {
      if (generation !== requestGeneration) {
        teardownResizeRetry()
        return
      }
      if (el.offsetWidth > 0) pushAd(generation)
    })
    resizeObserver.observe(el)
  }

  function pushAd(generation: number) {
    if (!import.meta.client || generation !== requestGeneration || !canRequest() || hasRequestedAd.value) return
    const containerEl = container.value
    if (!containerEl?.querySelector('ins.adsbygoogle')) return
    // 부모가 display:none (예: cross-viewport hidden md:block) 이면 push skip — wasted impression 방지.
    // happy-dom 테스트 환경에서는 offsetWidth 가 layout 계산 후에야 0/non-0 으로 의미를 가지므로
    // 0 을 명시적으로만 차단 (undefined/NaN 은 통과). 0폭이면 폭이 잡힐 때까지 재시도 예약.
    if (containerEl.offsetWidth === 0) {
      scheduleResizeRetry(generation, containerEl)
      return
    }
    teardownResizeRetry()
    hasRequestedAd.value = true
    try {
      const win = window as Window & { adsbygoogle?: Array<Record<string, never>> }
      win.adsbygoogle = win.adsbygoogle || []
      win.adsbygoogle.push({})
    } catch {
      // adsbygoogle push 실패는 무시 (광고 차단기/네트워크 실패 시 자연 collapse)
    }
  }

  function scheduleAdRequest() {
    if (!import.meta.client || !canRequest()) return
    hasRequestedAd.value = false
    teardownResizeRetry()
    teardownViewabilityGate()
    const generation = ++requestGeneration
    const el = container.value
    // IntersectionObserver 미지원(구형 브라우저/SSR/테스트 환경) → 즉시 push 폴백(광고 유실 방지).
    if (!el || typeof IntersectionObserver === 'undefined') {
      nextTick(() => pushAd(generation))
      return
    }
    // 슬롯이 뷰포트에 근접하면 1회만 발화하고 정리한다.
    // 폴드 상단 슬롯은 관찰 즉시 교차 콜백이 와서 사실상 로드 시 발화한다.
    viewabilityObserver = new IntersectionObserver(
      (entries) => {
        if (generation !== requestGeneration) {
          teardownViewabilityGate()
          return
        }
        if (entries.some((entry) => entry.isIntersecting)) {
          teardownViewabilityGate()
          nextTick(() => pushAd(generation))
        }
      },
      { rootMargin: VIEWABILITY_ROOT_MARGIN },
    )
    viewabilityObserver.observe(el)
  }

  onBeforeUnmount(clearPendingAdRequest)

  return {
    clearPendingAdRequest,
    hasRequestedAd,
    scheduleAdRequest,
  }
}
