import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, onMounted, reactive, ref } from 'vue'
import { vi } from 'vitest'
import AdBanner from '~/components/ads/AdBanner.vue'
import { useAdSenseRuntime } from '~/composables/useAdSenseRuntime'

function delayedClientOnly(ticks = 1) {
  return defineComponent({
    setup(_, { slots }) {
      const show = ref(false)
      onMounted(async () => {
        for (let i = 0; i < ticks; i++) await nextTick()
        show.value = true
      })
      return () => (show.value ? slots.default?.() : null)
    },
  })
}
export const deferredClientOnlyStub = delayedClientOnly()

export async function flushAds() {
  for (let i = 0; i < 5; i++) await nextTick()
}

export interface ControlledIntersection {
  callback: IntersectionObserverCallback
  elements: Set<Element>
  options: IntersectionObserverInit
}

export function setupAdEnvironment(
  options: {
    width?: number
    desktop?: boolean
    path?: string
    near?: boolean
    visible?: boolean
    intersectionObserver?: boolean
  } = {}
) {
  let width = options.width ?? 353
  let near = options.near ?? true
  let visibility = options.visible === false ? 'hidden' : 'visible'
  const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
  const rectDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'getBoundingClientRect'
  )
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  const renderedHeights = new WeakMap<HTMLElement, number>()
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      const rect = originalRect.call(this)
      const height = renderedHeights.get(this)
      return height === undefined ? rect : new DOMRect(rect.x, rect.y, rect.width, height)
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => width,
  })
  const route = reactive({ path: options.path ?? '/guide/example', name: 'guide-slug' })
  const app = {}
  const push = vi.fn()
  const observers: Array<{ callback: ResizeObserverCallback; elements: Set<Element> }> = []
  class ControlledResizeObserver {
    record: (typeof observers)[number]
    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, elements: new Set() }
      observers.push(this.record)
    }
    observe(element: Element) {
      this.record.elements.add(element)
    }
    unobserve(element: Element) {
      this.record.elements.delete(element)
    }
    disconnect() {
      this.record.elements.clear()
    }
  }
  const intersections: ControlledIntersection[] = []
  function emitIntersection(record: ControlledIntersection, target: Element, isIntersecting: boolean) {
    record.callback(
      [{ target, isIntersecting, intersectionRatio: 0 } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  }
  class ControlledIntersectionObserver {
    record: ControlledIntersection
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.record = { callback, options, elements: new Set() }
      intersections.push(this.record)
    }
    observe(element: Element) {
      this.record.elements.add(element)
      queueMicrotask(() => {
        if (this.record.elements.has(element)) emitIntersection(this.record, element, near)
      })
    }
    unobserve(element: Element) {
      this.record.elements.delete(element)
    }
    disconnect() {
      this.record.elements.clear()
    }
  }
  function setNear(value: boolean, target?: Element) {
    near = value
    for (const record of intersections)
      for (const element of [...record.elements])
        if (!target || element === target) emitIntersection(record, element, value)
  }
  const listeners = new Set<() => void>()
  const mq = {
    matches: options.desktop ?? false,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver)
  vi.stubGlobal(
    'IntersectionObserver',
    options.intersectionObserver === false ? undefined : ControlledIntersectionObserver
  )
  vi.stubGlobal('matchMedia', () => mq)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useNuxtApp', () => app)
  ;(globalThis as any).__resetUseState()
  ;(window as any).adsbygoogle = { push }
  return {
    app,
    route,
    push,
    observers,
    intersections,
    enterViewport(target?: Element) {
      setNear(true, target)
    },
    leaveViewport(target?: Element) {
      setNear(false, target)
    },
    setVisibility(value: 'visible' | 'hidden') {
      visibility = value
      document.dispatchEvent(new Event('visibilitychange'))
    },
    flush: flushAds,
    setWidth(value: number) {
      width = value
    },
    setRenderedHeight(ins: HTMLElement, height: number) {
      renderedHeights.set(ins, height)
    },
    triggerResize() {
      for (const entry of observers)
        if (entry.elements.size) entry.callback([], {} as ResizeObserver)
    },
    resize(desktop: boolean) {
      mq.matches = desktop
      listeners.forEach((cb) => cb())
    },
    dispose() {
      listeners.clear()
      for (const record of intersections) record.elements.clear()
      for (const record of observers) record.elements.clear()
      if (visibilityDescriptor)
        Object.defineProperty(document, 'visibilityState', visibilityDescriptor)
      else Reflect.deleteProperty(document, 'visibilityState')
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth')
      if (rectDescriptor)
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', rectDescriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
      delete (window as any).adsbygoogle
      delete (window as any).__ilsangkitAdDebug
      sessionStorage.clear()
      vi.unstubAllGlobals()
      ;(globalThis as any).__resetUseState()
    },
  }
}

export function mountAdHarness(
  options: Parameters<typeof setupAdEnvironment>[0] & {
    loaderPhase?: 'idle' | 'loading' | 'ready' | 'error'
    props?: Record<string, unknown>
    clientDelayTicks?: number
  } = {}
) {
  const env = setupAdEnvironment(options)
  const loader = useState('ads:loader', () => ({
    phase: options.loaderPhase ?? 'ready',
    attempts: 1,
  }))
  useAdSenseRuntime().initializeDebug()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mount(AdBanner, {
    attachTo: host,
    props: options.props,
    global: { stubs: { AdBanner: false, ClientOnly: delayedClientOnly(options.clientDelayTicks) } },
  })
  return {
    ...env,
    wrapper,
    loader,
    dispose() {
      wrapper.unmount()
      host.remove()
      env.dispose()
    },
  }
}

export async function mountPluginHarness() {
  const { effectScope } = await import('vue')
  const env = setupAdEnvironment()
  // happy-dom dispatches an error when external loading is disabled. Keep SDK
  // tags inert so only the test's explicit load/error event changes the loader.
  const append = document.head.appendChild.bind(document.head)
  const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
    if (node instanceof HTMLScriptElement) node.type = 'application/x-ad-test'
    return append(node)
  })
  Object.assign(env.app, { runWithContext: (fn: () => unknown) => fn() })
  const callbacks: Array<() => void> = []
  vi.stubGlobal('defineNuxtPlugin', (fn: (app: object) => unknown) => fn)
  vi.stubGlobal('onNuxtReady', (fn: () => void) => callbacks.push(fn))
  const { default: plugin } = await import('~/plugins/adsense.client')
  let scope = effectScope()
  const setup = () => scope.run(() => (plugin as unknown as (app: object) => void)(env.app))
  setup()
  return {
    ...env,
    setup,
    suspend() {
      scope.stop()
    },
    resume() {
      scope = effectScope()
      setup()
    },
    async nuxtReady() {
      callbacks.splice(0).forEach((fn) => fn())
      await flushAds()
    },
    async navigate(path: string) {
      window.history.replaceState({}, '', path)
      env.route.path = path
      await flushAds()
    },
    dispose() {
      scope.stop()
      appendSpy.mockRestore()
      document
        .querySelectorAll('script[src*="pagead/js/adsbygoogle.js"]')
        .forEach((el) => el.remove())
      window.history.replaceState({}, '', '/')
      env.dispose()
    },
  }
}

export async function mountRequestHarness(
  options: Parameters<typeof setupAdEnvironment>[0] & {
    ready?: boolean
    allowed?: boolean
    resizeObserver?: boolean
  } = {}
) {
  const { h, shallowRef } = await import('vue')
  const { useDeferredAdSenseRequest } = await import('~/components/ads/useDeferredAdSenseRequest')
  const env = setupAdEnvironment(options)
  if (options.resizeObserver === false) vi.stubGlobal('ResizeObserver', undefined)
  const ready = ref(options.ready ?? true)
  const allowed = ref(options.allowed ?? true)
  const key = ref(0)
  const container = shallowRef<HTMLElement | null>(null)
  const element = shallowRef<HTMLElement | null>(null)
  const events = vi.fn()
  const beforePush = vi.fn()
  let request!: ReturnType<typeof useDeferredAdSenseRequest>
  const Component = defineComponent({
    setup() {
      request = useDeferredAdSenseRequest(container, () => allowed.value, {
        element,
        sdkReady: () => ready.value,
        beforePush,
        onEvent: events,
      })
      return () =>
        h('div', { ref: container }, [
          h('ins', { key: key.value, ref: element, class: 'adsbygoogle', style: 'display:block' }),
        ])
    },
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mount(Component, { attachTo: host })
  return {
    ...env,
    request,
    element,
    container,
    host,
    events,
    beforePush,
    setReady(value: boolean) {
      ready.value = value
    },
    setAllowed(value: boolean) {
      allowed.value = value
    },
    replaceElement() {
      key.value++
    },
    unmount() {
      wrapper.unmount()
    },
    dispose() {
      wrapper.unmount()
      host.remove()
      env.dispose()
    },
  }
}
