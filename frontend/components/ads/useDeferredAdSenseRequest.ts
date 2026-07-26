import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export function useDeferredAdSenseRequest(
  container: Ref<HTMLElement | null>,
  canRequest: () => boolean = () => true,
) {
  const hasRequestedAd = ref(false)
  let requestGeneration = 0
  let resizeObserver: ResizeObserver | null = null

  function teardownResizeRetry() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  function clearPendingAdRequest() {
    requestGeneration++
    teardownResizeRetry()
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
    const generation = ++requestGeneration
    // 즉시 push — 지연/뷰포트 게이팅 제거 (AdSense가 동일 페이지 다중 슬롯을 한꺼번에 인지해야 채움률 확보)
    nextTick(() => pushAd(generation))
  }

  onBeforeUnmount(clearPendingAdRequest)

  return {
    clearPendingAdRequest,
    hasRequestedAd,
    scheduleAdRequest,
  }
}
