import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReadonly } from 'vue'
import { createAdDebugStore, useAdSenseRuntime } from '~/composables/useAdSenseRuntime'
import { setupAdEnvironment } from '../helpers/adHarness'

let env: ReturnType<typeof setupAdEnvironment> | undefined
afterEach(() => {
  env?.dispose()
  env = undefined
  vi.restoreAllMocks()
})
describe('ad runtime', () => {
  it('shares readonly loader state within an app', () => {
    env = setupAdEnvironment()
    const first = useAdSenseRuntime(),
      second = useAdSenseRuntime()
    first.setLoader('ready', 1)
    expect(second.loader.value).toEqual({ phase: 'ready', attempts: 1 })
    expect(isReadonly(second.loader)).toBe(true)
    expect(isReadonly(second.loader.value)).toBe(true)
  })
  it('keeps diagnostics per app and initializes once', () => {
    env = setupAdEnvironment()
    const first = useAdSenseRuntime()
    first.initializeDebug()
    first.record({ kind: 'script-start' })
    first.initializeDebug()
    expect(window.__ilsangkitAdDebug?.snapshot()).toHaveLength(1)
    vi.stubGlobal('useNuxtApp', () => ({}))
    ;(globalThis as any).__resetUseState()
    const second = useAdSenseRuntime()
    second.initializeDebug()
    expect(second.loader.value.phase).toBe('idle')
    expect(window.__ilsangkitAdDebug?.snapshot()).toHaveLength(0)
  })
  it('does not expose an API in production without opt-in', () => {
    const store = createAdDebugStore({ dev: false, readDebugSetting: () => null, now: () => 0 })
    store.record({ kind: 'waiting-viewport' })
    store.record({ kind: 'waiting-visible' })
    expect(store.enabled).toBe(false)
    expect(store.snapshot()).toEqual([])
  })
  it('records proximity and visibility as identifiers only', () => {
    const store = createAdDebugStore({ dev: true, readDebugSetting: () => null, now: () => 0 })
    store.record({ kind: 'waiting-viewport' })
    store.record({ kind: 'waiting-visible' })
    expect(store.snapshot().map(({ kind }) => kind)).toEqual(['waiting-viewport', 'waiting-visible'])
  })
  it('tolerates denied storage and enables dev without storage access', () => {
    const denied = () => {
      throw new Error('denied')
    }
    expect(createAdDebugStore({ dev: false, readDebugSetting: denied, now: () => 0 }).enabled).toBe(
      false
    )
    expect(createAdDebugStore({ dev: true, readDebugSetting: denied, now: () => 0 }).enabled).toBe(
      true
    )
  })
  it.each(['waiting-width', 'waiting-viewport', 'waiting-visible'] as const)(
    'caps, whitelists and copies %s diagnostics',
    (kind) => {
      const store = createAdDebugStore({ dev: false, readDebugSetting: () => '1', now: () => 4 })
      for (let width = 0; width < 201; width++)
        store.record({
          kind,
          width,
          pageType: '/private/path',
          url: '/private',
          message: 'secret',
        } as any)
      const snapshot = store.snapshot()
      expect(snapshot).toHaveLength(200)
      expect(snapshot[0]).toEqual({ kind, width: 1, pageType: 'other', at: 4 })
      snapshot[0].width = -1
      expect(store.snapshot()[0].width).toBe(1)
      expect(JSON.stringify(store.snapshot())).not.toMatch(/private|secret/)
    }
  )
})
