import { afterEach, expect, it, vi } from 'vitest'
import { useAdSenseRuntime } from '~/composables/useAdSenseRuntime'
afterEach(() => {
  vi.unstubAllGlobals()
  ;(globalThis as any).__resetUseState()
})
it('does not touch window or create a diagnostic store in the server branch', () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('useNuxtApp', () => ({}))
  const runtime = useAdSenseRuntime()
  expect(() => {
    runtime.initializeDebug()
    runtime.record({ kind: 'script-start' })
  }).not.toThrow()
  expect(runtime.loader.value).toEqual({ phase: 'idle', attempts: 0 })
})
