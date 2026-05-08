import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue'

export const AD_REQUEST_DELAY_MS = 500
export const AD_REQUEST_ROOT_MARGIN = '600px 0px'

export function useDeferredAdSenseRequest(
  container: Ref<HTMLElement | null>,
  canRequest: () => boolean = () => true,
) {
  const hasRequestedAd = ref(false)

  let delayTimer: ReturnType<typeof setTimeout> | null = null
  let animationFrameId: number | null = null
  let intersectionObserver: IntersectionObserver | null = null
  let requestGeneration = 0

  function clearPendingAdRequest() {
    requestGeneration++
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    if (animationFrameId !== null && import.meta.client) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (intersectionObserver) {
      intersectionObserver.disconnect()
      intersectionObserver = null
    }
  }

  function pushAd() {
    if (!import.meta.client || !canRequest() || hasRequestedAd.value) return
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

  function requestWhenNearViewport(generation: number) {
    if (
      !import.meta.client ||
      generation !== requestGeneration ||
      !canRequest() ||
      hasRequestedAd.value
    ) return

    const target = container.value
    if (!target) return

    if (!('IntersectionObserver' in window)) {
      pushAd()
      return
    }

    intersectionObserver = new IntersectionObserver((entries) => {
      if (generation !== requestGeneration || !canRequest()) return
      if (!entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) return
      intersectionObserver?.disconnect()
      intersectionObserver = null
      pushAd()
    }, {
      rootMargin: AD_REQUEST_ROOT_MARGIN,
      threshold: 0,
    })
    intersectionObserver.observe(target)
  }

  function scheduleAdRequest() {
    if (!import.meta.client || !canRequest()) return
    clearPendingAdRequest()
    hasRequestedAd.value = false
    const generation = requestGeneration
    nextTick(() => {
      if (generation !== requestGeneration || !canRequest()) return
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        delayTimer = setTimeout(() => {
          delayTimer = null
          requestWhenNearViewport(generation)
        }, AD_REQUEST_DELAY_MS)
      })
    })
  }

  onBeforeUnmount(clearPendingAdRequest)

  return {
    clearPendingAdRequest,
    hasRequestedAd,
    scheduleAdRequest,
  }
}
