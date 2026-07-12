import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useNationalComplexCount } from '~/composables/useNationalComplexCount'

describe('useNationalComplexCount', () => {
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

  it('성공 시 total을 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { total: 543210 } })
    vi.stubGlobal('$fetch', fetchMock)
    stubNuxt()
    const { total } = useNationalComplexCount('apt-sale')
    await vi.waitFor(() => expect(total.value).not.toBeNull())
    expect(total.value).toBe(543210)
    // S3의 기존 getComplexList 엔드포인트와 동일 경로, city/district 없이 page:1, limit:1
    expect(fetchMock).toHaveBeenCalledWith(
      'http://test-api/api/real-estate/apt-sale/complexes',
      expect.objectContaining({ query: { page: 1, limit: 1 } }),
    )
  })

  it('fetch 실패 시 null을 반환한다 (fail-open, throw 안 함)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('$fetch', fetchMock)
    stubNuxt()
    expect(() => useNationalComplexCount('apt-sale')).not.toThrow()
    const { total } = useNationalComplexCount('apt-sale')
    // 거부(rejection)가 컴포저블의 catch를 실제로 통과할 때까지 대기 (non-vacuous:
    // 초기 동기 null이 아니라 fetch 호출 후 catch 경로를 실제로 거친 뒤의 값을 검증)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await Promise.resolve()
    await Promise.resolve()
    expect(total.value).toBeNull()
  })

  it('server:true 옵션으로 useAsyncData를 호출한다 (SSR에서도 fetch)', () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: { total: 0 } }))
    const captured = stubNuxt()
    useNationalComplexCount('apt-sale')
    expect(captured.key).toBe('national-complex-apt-sale')
    expect(captured.opts).toMatchObject({ server: true })
  })

  it('키가 apiSlug별로 달라진다', () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ success: true, data: { total: 0 } }))
    const captured = stubNuxt()
    useNationalComplexCount('villa-rent')
    expect(captured.key).toBe('national-complex-villa-rent')
  })
})
