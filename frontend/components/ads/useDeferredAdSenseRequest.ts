import { nextTick, onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

export type RequestEvent =
  | 'waiting-sdk'
  | 'waiting-width'
  | 'waiting-viewport'
  | 'waiting-visible'
  | 'push-attempt'
  | 'push-returned'
  | 'push-error'
export interface AdRequestOptions {
  element: Ref<HTMLElement | null>
  sdkReady: () => boolean
  beforePush: (ins: HTMLElement) => void
  onEvent: (event: RequestEvent, errorKind?: 'type-error' | 'error' | 'unknown') => void
}
type Outcome = 'idle' | 'returned' | 'error'

export function useDeferredAdSenseRequest(
  container: Ref<HTMLElement | null>,
  canRequest: () => boolean,
  options: AdRequestOptions
) {
  const attempted = ref(false)
  const outcome = ref<Outcome>('idle')
  const attempts = new WeakMap<HTMLElement, Outcome>()
  const nearElements = new WeakSet<HTMLElement>()
  let generation = 0
  let disposed = false
  let pending = false
  let observer: ResizeObserver | null = null
  let intersection: IntersectionObserver | null = null
  let visibilityListener: (() => void) | null = null
  let resizeFallback: (() => void) | null = null
  let waiting: RequestEvent | null = null
  let current: HTMLElement | null = null

  function stopResize() {
    observer?.disconnect()
    observer = null
    if (resizeFallback) window.removeEventListener('resize', resizeFallback)
    resizeFallback = null
  }
  function stopVisibility() {
    if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener)
    visibilityListener = null
  }
  function clearPendingAdRequest() {
    generation++
    pending = false
    stopResize()
    intersection?.disconnect()
    intersection = null
    stopVisibility()
  }
  function reportWait(reason: RequestEvent) {
    if (waiting !== reason) options.onEvent(reason)
    waiting = reason
  }
  function pushAd(token: number) {
    if (disposed || token !== generation) return
    const ins = options.element.value
    const parent = container.value
    if (ins !== current) {
      current = ins
      waiting = null
      attempted.value = !!ins && attempts.has(ins)
      outcome.value = ins ? (attempts.get(ins) ?? 'idle') : 'idle'
    }
    if (
      !canRequest() ||
      !ins?.isConnected ||
      !parent?.isConnected ||
      !parent.contains(ins) ||
      attempts.has(ins)
    ) {
      waiting = null
      clearPendingAdRequest()
      return
    }
    // Observe before SDK/width waits so an early approach qualifies this ins.
    if (!nearElements.has(ins) && !intersection) {
      if (typeof IntersectionObserver === 'undefined') nearElements.add(ins)
      else {
        intersection = new IntersectionObserver(
          (entries) => {
            if (
              disposed ||
              token !== generation ||
              ins !== options.element.value ||
              parent !== container.value ||
              !canRequest()
            )
              return
            if (!entries.some((entry) => entry.target === parent && entry.isIntersecting)) return
            nearElements.add(ins)
            intersection?.disconnect()
            intersection = null
            reevaluate()
          },
          { root: null, rootMargin: '0px 0px 300px 0px', threshold: 0 }
        )
        intersection.observe(parent)
      }
    }
    if (!options.sdkReady()) {
      stopResize()
      stopVisibility()
      reportWait('waiting-sdk')
      return
    }
    if (getComputedStyle(ins).display === 'none') {
      waiting = null
      stopResize()
      stopVisibility()
      return
    }
    if (!(parent.offsetWidth > 0) || !Number.isFinite(parent.offsetWidth)) {
      stopVisibility()
      reportWait('waiting-width')
      if (!observer && !resizeFallback) {
        const retry = () => {
          if (!disposed && token === generation && ins === options.element.value) reevaluate()
        }
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(retry)
          observer.observe(parent)
        } else {
          resizeFallback = retry
          window.addEventListener('resize', retry)
        }
      }
      return
    }
    stopResize()
    if (!nearElements.has(ins)) {
      stopVisibility()
      reportWait('waiting-viewport')
      return
    }
    if (document.visibilityState !== 'visible') {
      reportWait('waiting-visible')
      if (!visibilityListener) {
        visibilityListener = () => {
          if (!disposed && token === generation && ins === options.element.value) reevaluate()
        }
        document.addEventListener('visibilitychange', visibilityListener)
      }
      return
    }
    stopVisibility()
    if (
      disposed ||
      token !== generation ||
      !canRequest() ||
      ins !== options.element.value ||
      parent !== container.value ||
      !ins.isConnected ||
      !parent.isConnected ||
      !parent.contains(ins) ||
      attempts.has(ins)
    )
      return
    waiting = null
    // Mark before callbacks: SDK push can synchronously resize or re-enter Vue.
    attempts.set(ins, 'idle')
    attempted.value = true
    try {
      options.beforePush(ins)
      options.onEvent('push-attempt')
      const win = window as Window & {
        adsbygoogle?: { push(value: Record<string, never>): unknown }
      }
      win.adsbygoogle = win.adsbygoogle || []
      win.adsbygoogle.push({})
      attempts.set(ins, 'returned')
      outcome.value = 'returned'
      options.onEvent('push-returned')
    } catch (error) {
      attempts.set(ins, 'error')
      outcome.value = 'error'
      options.onEvent(
        'push-error',
        error instanceof TypeError ? 'type-error' : error instanceof Error ? 'error' : 'unknown'
      )
    } finally {
      clearPendingAdRequest()
    }
  }
  function reevaluate() {
    if (!import.meta.client || disposed || pending) return
    pending = true
    const token = generation
    void nextTick(() => {
      if (token !== generation || disposed) return
      pending = false
      pushAd(token)
    })
  }
  watch(
    [container, options.element, canRequest, options.sdkReady],
    () => {
      clearPendingAdRequest()
      reevaluate()
    },
    { flush: 'post', immediate: true }
  )
  onBeforeUnmount(() => {
    disposed = true
    clearPendingAdRequest()
  })
  return {
    attempted: readonly(attempted),
    outcome: readonly(outcome),
    reevaluate,
    clearPendingAdRequest,
  }
}
