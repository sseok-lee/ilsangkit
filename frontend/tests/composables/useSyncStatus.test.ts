import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSyncStatus } from '~/composables/useSyncStatus'

describe('useSyncStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubNuxt(fixture: Record<string, string | null> | null) {
    const captured: { key?: string; opts?: Record<string, unknown> } = {}
    vi.stubGlobal('useApiBase', () => 'http://test-api')
    vi.stubGlobal('useAsyncData', (key: string, _handler: unknown, opts: Record<string, unknown>) => {
      captured.key = key
      captured.opts = opts
      return { data: ref(fixture) }
    })
    return captured
  }

  it('stable key "sync-status" + server:false로 useAsyncData를 호출한다', () => {
    const captured = stubNuxt(null)
    useSyncStatus()
    expect(captured.key).toBe('sync-status')
    expect(captured.opts).toMatchObject({ server: false })
  })

  it('latestOverall: 전체 값 중 최신 ISO를 반환한다 (null 무시)', () => {
    stubNuxt({ pharmacy: '2026-06-19T00:00:00.000Z', aptSale: '2026-07-10T06:00:00.000Z', trash: null })
    const { latestOverall } = useSyncStatus()
    expect(latestOverall.value).toBe('2026-07-10T06:00:00.000Z')
  })

  it('latestOverall: 데이터 없으면 null', () => {
    stubNuxt(null)
    const { latestOverall } = useSyncStatus()
    expect(latestOverall.value).toBeNull()
  })
})
