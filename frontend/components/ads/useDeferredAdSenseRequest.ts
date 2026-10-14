import { nextTick, onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

export type RequestEvent =
  | 'waiting-sdk'
  | 'waiting-width'
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
  let generation = 0
  let disposed = false
  let pending = false
  let observer: ResizeObserver | null = null
  let resizeFallback: (() => void) | null = null
  let waiting: RequestEvent | null = null
  let current: HTMLElement | null = null

  function stopResize() {
    observer?.disconnect()
    observer = null
    if (resizeFallback) window.removeEventListener('resize', resizeFallback)
    resizeFallback = null
  }
  function clearPendingAdRequest() {
    generation++
    pending = false
    stopResize()
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
    )
      return
    if (!options.sdkReady()) {
      reportWait('waiting-sdk')
      return
    }
    if (getComputedStyle(ins).display === 'none') return
    if (!(parent.offsetWidth > 0) || !Number.isFinite(parent.offsetWidth)) {
      reportWait('waiting-width')
      if (!observer && !resizeFallback) {
        const retry = () => {
          if (token === generation && ins === options.element.value) reevaluate()
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
