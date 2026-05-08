import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export function useDeferredAdSenseRequest(
  container: Ref<HTMLElement | null>,
  canRequest: () => boolean = () => true,
) {
  const hasRequestedAd = ref(false)
  let requestGeneration = 0

  function clearPendingAdRequest() {
    requestGeneration++
  }

  function pushAd(generation: number) {
    if (!import.meta.client || generation !== requestGeneration || !canRequest() || hasRequestedAd.value) return
    if (!container.value?.querySelector('ins.adsbygoogle')) return
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
