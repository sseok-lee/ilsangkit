import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useNationalStats } from '~/composables/useNationalStats'

// fail-open 테스트 전용 sentinel. 반드시 primitive여야 한다 — 컴포저블이 반환하는
// `stats`는 readonly()로 감싸여 있어, 객체를 넣으면 읽을 때마다 Vue가 새 reactive
// proxy로 래핑해 참조 비교(toBe)가 초기값에서부터 항상 "다름"으로 오판된다
// (mutation과 무관하게 항상 통과 = 다시 무력화). 최종 기대값(null)과 달라야
// "catch가 실제로 실행되어 값이 바뀌었는지"를 구분할 수 있다.
const FAIL_OPEN_SENTINEL = '__FAIL_OPEN_SENTINEL__'

describe('useNationalStats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * useAsyncData mock: 실제 컴포저블의 fetcher(handler)를 즉시 실행해 그 결과를
   * data ref에 반영한다 (fail-open try/catch가 실제로 동작하는지 검증하기 위함).
   * initialData: data ref의 초기값 (기본 null). fail-open 테스트는 sentinel로 초기화한다.
   */
  function stubNuxt(initialData: unknown = null) {
    const captured: { key?: string; opts?: Record<string, unknown> } = {}
    vi.stubGlobal('useApiBase', () => 'http://test-api')
    vi.stubGlobal('useAsyncData', (key: string, handler: () => Promise<unknown>, opts: Record<string, unknown>) => {
      captured.key = key
      captured.opts = opts
      const data = ref(initialData)
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
    stubNuxt(FAIL_OPEN_SENTINEL)
    expect(() => useNationalStats()).not.toThrow()
    const { stats } = useNationalStats()
    // sentinel에서 벗어날 때까지 대기 (non-vacuous: 컴포저블의 catch가 삭제되면
    // 거부된 handler()의 .then이 실행되지 않아 data가 sentinel에 영원히 머물러
    // 이 waitFor가 타임아웃되며 테스트가 실패한다)
    await vi.waitFor(() => expect(stats.value).not.toBe(FAIL_OPEN_SENTINEL))
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
