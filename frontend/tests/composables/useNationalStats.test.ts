import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useNationalStats } from '~/composables/useNationalStats'

describe('useNationalStats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * useAsyncData mock: 실제 컴포저블의 fetcher(handler)를 즉시 실행해 그 결과를
   * data ref에 반영한다 (fail-open try/catch가 실제로 동작하는지 검증하기 위함).
   */
  function stubNuxt() {
    const captured: { key?: string; opts?: Record<string, unknown> } = {}
    vi.stubGlobal('useApiBase', () => 'http://test-api')
    vi.stubGlobal('useAsyncData', (key: string, handler: () => Promise<unknown>, opts: Record<string, unknown>) => {
      captured.key = key
      captured.opts = opts
      const data = ref(null)
      const promise = handler().then((value) => {
        data.value = value as never
      })
      return Object.assign(promise, { data })
    })
    return captured
  }

  it('성공 시 data(StatsData)를 반환한다', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ success: true, data: { total: 1234567, toilet: 1000 } }),
    )
    stubNuxt()
    const { stats } = useNationalStats()
    await vi.waitFor(() => expect(stats.value).not.toBeNull())
    expect(stats.value?.total).toBe(1234567)
    expect(stats.value?.toilet).toBe(1000)
  })

  it('fetch 실패 시 null을 반환한다 (fail-open, throw 안 함)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('$fetch', fetchMock)
    stubNuxt()
    expect(() => useNationalStats()).not.toThrow()
    const { stats } = useNationalStats()
    // 거부(rejection)가 컴포저블의 catch를 실제로 통과할 때까지 대기
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await Promise.resolve()
    await Promise.resolve()
    // fail-open: catch를 거친 뒤에도 null 유지 (throw 안 함)
    expect(stats.value).toBeNull()
  })

  it('server:true 옵션으로 useAsyncData를 호출한다 (SSR에서도 fetch)', () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: {} }))
    const captured = stubNuxt()
    useNationalStats()
    expect(captured.key).toBe('national-stats')
    expect(captured.opts).toMatchObject({ server: true })
  })
})
