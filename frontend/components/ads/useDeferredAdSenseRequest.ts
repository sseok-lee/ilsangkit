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
  minWidth?: number
}
type Outcome = 'idle' | 'returned' | 'error'

// Only elements registered by this request helper belong to the app. Never
// change provider-created elements or forge data-adsbygoogle-status.
const ownedElements = new Set<HTMLElement>()

function pushOwnedAd(ins: HTMLElement, push: () => void) {
  // The loaded SDK selects the first available INS synchronously for push({}).
  // Withhold other owned candidates for this call, including failed attempts
  // that the SDK never marked done. Their guards/sizing must run on their turn.
  const withheld = Array.from(ownedElements).filter(
    (element) =>
      element !== ins &&
      element.classList.contains('adsbygoogle') &&
      !['done', 'reserved'].includes(element.dataset.adsbygoogleStatus ?? '')
  )
  try {
    for (const element of withheld) element.classList.remove('adsbygoogle')
    push()
  } finally {
    // Restore only our token; preserve all other SDK class/style mutations.
    for (const element of withheld) element.classList.add('adsbygoogle')
  }
}

export function measureAdContentWidth(element: HTMLElement): number {
  if (!import.meta.client) return 0
  const css = getComputedStyle(element)
  const px = (value: string) => Number.parseFloat(value) || 0
  const width = element.getBoundingClientRect().width
    - px(css.paddingLeft) - px(css.paddingRight)
    - px(css.borderLeftWidth) - px(css.borderRightWidth)
  return Number.isFinite(width) ? Math.max(0, width) : 0
}

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
    const hasEnoughWidth = () => {
      const width =
        options.minWidth === undefined ? parent.offsetWidth : measureAdContentWidth(parent)
      return Number.isFinite(width) && width > 0 && width >= (options.minWidth ?? 0)
    }
    const waitForWidth = () => {
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
    if (!hasEnoughWidth()) {
      waitForWidth()
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
    if (!hasEnoughWidth()) {
      waitForWidth()
      return
    }
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
      pushOwnedAd(ins, () => win.adsbygoogle!.push({}))
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
  // Register as refs attach, before any sibling's nextTick request can run.
  watch(
    options.element,
    (ins, previous) => {
      if (!import.meta.client) return
      if (previous) ownedElements.delete(previous)
      if (ins) ownedElements.add(ins)
    },
    { flush: 'sync', immediate: true }
  )
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
    if (options.element.value) ownedElements.delete(options.element.value)
    clearPendingAdRequest()
  })
  return {
    attempted: readonly(attempted),
    outcome: readonly(outcome),
    reevaluate,
    clearPendingAdRequest,
  }
}
