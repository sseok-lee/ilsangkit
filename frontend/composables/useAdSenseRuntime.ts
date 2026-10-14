import { readonly, type Ref } from 'vue'

export type LoaderPhase = 'idle' | 'loading' | 'ready' | 'error'
export interface AdLoaderState {
  phase: LoaderPhase
  attempts: number
}
export type AdPageType =
  | 'building-detail'
  | 'subscription-detail'
  | 'facility-detail'
  | 'guide-detail'
  | 'other'
export type AdDebugKind =
  | 'script-start'
  | 'script-ready'
  | 'script-error'
  | 'script-retry'
  | 'slot-mounted'
  | 'waiting-sdk'
  | 'waiting-width'
  | 'push-attempt'
  | 'push-returned'
  | 'push-error'
  | 'status-change'
  | 'element-hidden'
  | 'element-shown'
  | 'slot-disposed'
export type AdCollapseReason = 'unfilled' | 'loader-error' | 'element-hidden' | null
export interface AdDebugInput {
  kind: AdDebugKind
  instanceId?: number
  pageType?: AdPageType
  order?: number
  device?: 'mobile' | 'desktop'
  adSlot?: string
  width?: number
  height?: number
  status?: string
  collapseReason?: AdCollapseReason
  errorKind?: 'type-error' | 'error' | 'unknown'
}
export interface AdDebugEvent extends AdDebugInput {
  at: number
}
export interface AdDebugStore {
  readonly enabled: boolean
  record(input: AdDebugInput): void
  snapshot(): AdDebugEvent[]
}
export interface AdSenseRuntime {
  loader: Readonly<Ref<Readonly<AdLoaderState>>>
  setLoader(phase: LoaderPhase, attempts: number): void
  initializeDebug(): void
  record(input: AdDebugInput): void
}

declare global {
  interface Window {
    __ilsangkitAdDebug?: { snapshot(): AdDebugEvent[] }
  }
}

const pageTypes = new Set<AdPageType>([
  'building-detail',
  'subscription-detail',
  'facility-detail',
  'guide-detail',
  'other',
])
const fields = [
  'instanceId',
  'order',
  'device',
  'adSlot',
  'width',
  'height',
  'status',
  'collapseReason',
  'errorKind',
] as const

export function createAdDebugStore(options: {
  dev: boolean
  readDebugSetting: () => string | null
  now: () => number
}): AdDebugStore {
  let enabled = options.dev
  if (!enabled) {
    try {
      enabled = options.readDebugSetting() === '1'
    } catch {
      /* Storage denial must not affect ads. */
    }
  }
  // Disabled diagnostics retain neither an event array nor callers' input objects.
  if (!enabled) return { enabled: false, record() {}, snapshot: () => [] }
  const events: AdDebugEvent[] = []
  return {
    enabled,
    record(input) {
      const event: AdDebugEvent = { kind: input.kind, at: options.now() }
      for (const field of fields) {
        if (input[field] !== undefined) Object.assign(event, { [field]: input[field] })
      }
      if (input.pageType !== undefined)
        event.pageType = pageTypes.has(input.pageType) ? input.pageType : 'other'
      events.push(event)
      if (events.length > 200) events.splice(0, events.length - 200)
    },
    snapshot: () => events.map((event) => ({ ...event })),
  }
}

// DOM and debug records live on the client Nuxt app, never in SSR payload state.
const debugKey = Symbol.for('ilsangkit.adDebug')
type DebugApp = { [debugKey]?: AdDebugStore }
export function useAdSenseRuntime(): AdSenseRuntime {
  const loader = useState<AdLoaderState>('ads:loader', () => ({ phase: 'idle', attempts: 0 }))
  const app = useNuxtApp() as DebugApp
  return {
    loader: readonly(loader),
    setLoader(phase, attempts) {
      loader.value = { phase, attempts }
    },
    initializeDebug() {
      if (!import.meta.client) return
      app[debugKey] ??= createAdDebugStore({
        dev: import.meta.dev === true,
        readDebugSetting: () => sessionStorage.getItem('ads:debug'),
        now: () => performance.now(),
      })
      if (app[debugKey].enabled) window.__ilsangkitAdDebug = { snapshot: app[debugKey].snapshot }
    },
    record(input) {
      if (import.meta.client) app[debugKey]?.record(input)
    },
  }
}
