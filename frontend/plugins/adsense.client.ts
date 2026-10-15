import { getCurrentScope, onScopeDispose, watch } from 'vue'
import { canLoadAdScript, isAdFreePath } from '~/composables/useAdsPolicy'
import { useAdSenseRuntime } from '~/composables/useAdSenseRuntime'

const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'
const ownerKey = Symbol.for('ilsangkit.adLoader')
interface LoaderOwner {
  active: boolean
  hydrated: boolean
  script: HTMLScriptElement | null
  errorPath: string | null
  detach: () => void
}

export default defineNuxtPlugin((nuxtApp) => {
  // Old network errors must not disable ads throughout this browser session.
  try {
    sessionStorage.removeItem('ads:blocked')
  } catch {
    /* Storage can be unavailable. */
  }
  const runtime = useAdSenseRuntime()
  runtime.initializeDebug()
  const app = nuxtApp as typeof nuxtApp & { [ownerKey]?: LoaderOwner }
  if (app[ownerKey]?.active) return
  const owner = (app[ownerKey] ??= {
    active: false,
    hydrated: false,
    script: null,
    errorPath: null,
    detach() {},
  })
  owner.active = true
  const route = useRoute()
  const eligible = () =>
    !isAdFreePath(route.path) && nuxtApp.runWithContext(() => canLoadAdScript())

  function listen(script: HTMLScriptElement, attempt: number) {
    owner.detach()
    const finish = (phase: 'ready' | 'error') => {
      if (
        !owner.active ||
        script !== owner.script ||
        attempt !== runtime.loader.value.attempts ||
        runtime.loader.value.phase !== 'loading'
      )
        return
      if (phase === 'error') owner.errorPath = route.path
      runtime.setLoader(phase, attempt)
      runtime.record({ kind: phase === 'ready' ? 'script-ready' : 'script-error' })
      owner.detach()
    }
    const loaded = () => finish('ready')
    const failed = () => finish('error')
    script.addEventListener('load', loaded)
    script.addEventListener('error', failed)
    owner.detach = () => {
      script.removeEventListener('load', loaded)
      script.removeEventListener('error', failed)
    }
  }

  function load() {
    if (!owner.active || !owner.hydrated || !eligible()) return
    const state = runtime.loader.value
    if (state.phase === 'loading' || state.phase === 'ready') return
    if (state.phase === 'error') {
      if (
        state.attempts >= 2 ||
        route.path === owner.errorPath ||
        !navigator.onLine ||
        document.visibilityState !== 'visible'
      )
        return
      owner.detach()
      owner.script?.remove()
      owner.script = null
      runtime.record({ kind: 'script-retry' })
    }
    const attempt = state.attempts + 1
    // Adopt an existing SDK tag without injecting another or disturbing Auto Ads.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADSENSE_SRC}"]`)
    const script = existing ?? document.createElement('script')
    owner.script = script
    runtime.setLoader('loading', attempt)
    runtime.record({ kind: 'script-start' })
    listen(script, attempt)
    if (!existing) {
      script.src = ADSENSE_SRC
      script.async = true
      script.crossOrigin = 'anonymous'
      script.dataset.ilsangkitAdsense = 'true'
      document.head.appendChild(script)
    }
  }

  if (owner.script && runtime.loader.value.phase === 'loading')
    listen(owner.script, runtime.loader.value.attempts)
  const stop = watch(
    () => route.path,
    (path, previous) => {
      if (path !== previous) load()
    },
    { flush: 'post' }
  )
  // Script injection stays after hydration; no timeout is evidence of a load error.
  onNuxtReady(() => {
    if (owner.active) {
      owner.hydrated = true
      load()
    }
  })
  const dispose = () => {
    owner.active = false
    owner.detach()
    stop()
  }
  if (getCurrentScope()) onScopeDispose(dispose)
  if (import.meta.hot) import.meta.hot.dispose(dispose)
})
