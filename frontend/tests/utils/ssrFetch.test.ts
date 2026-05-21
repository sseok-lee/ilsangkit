import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))

vi.mock('ofetch', () => ({
  $fetch: mockFetch,
}))

vi.mock('~/server/utils/internalApiBase', () => ({
  getInternalApiBase: () => 'http://127.0.0.1:8000',
}))

import { ssrFetch } from '~/server/utils/ssrFetch'

describe('ssrFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('성공 시 응답을 그대로 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: { items: [1, 2] } })
    const result = await ssrFetch('/api/foo')
    expect(result).toEqual({ ok: true, data: { items: [1, 2] } })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('상대 경로에 internalApiBase를 prepend 한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    await ssrFetch('/api/foo')
    expect(mockFetch.mock.calls[0][0]).toBe('http://127.0.0.1:8000/api/foo')
  })

  it('절대 URL은 그대로 사용한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    await ssrFetch('https://external.example.com/api/x')
    expect(mockFetch.mock.calls[0][0]).toBe('https://external.example.com/api/x')
  })

  it('ECONNREFUSED 발생 시 retries 만큼 재시도하고 성공 시 결과 반환', async () => {
    const connErr = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)
      .mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)

    warnSpy.mockRestore()
  })

  it('cause.code 가 connection error 인 경우도 재시도한다', async () => {
    const wrappedErr = Object.assign(new Error('fetch failed'), {
      cause: { code: 'ECONNRESET' },
    })
    mockFetch.mockRejectedValueOnce(wrappedErr).mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })

  it('재시도 모두 실패하면 마지막 에러를 throw 한다', async () => {
    const connErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    // Attach catch immediately so the rejection is never unhandled
    let caughtErr: unknown
    const guarded = promise.catch((e) => { caughtErr = e })

    await vi.advanceTimersByTimeAsync(5000)
    await guarded

    expect(caughtErr).toMatchObject({ message: 'ECONNREFUSED' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it.each([502, 503, 504])('status %i 일 때 재시도한다', async (status) => {
    const httpErr = Object.assign(new Error(`HTTP ${status}`), { status })
    mockFetch.mockRejectedValueOnce(httpErr).mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await promise).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })

  it('statusCode 필드(ofetch 변종)도 인식한다', async () => {
    const httpErr = Object.assign(new Error('HTTP 502'), { statusCode: 502 })
    mockFetch.mockRejectedValueOnce(httpErr).mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await promise).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })

  it.each([400, 401, 403, 404, 408, 422, 429, 500])(
    'status %i 일 때 재시도하지 않고 즉시 throw 한다',
    async (status) => {
      const httpErr = Object.assign(new Error(`HTTP ${status}`), { status })
      mockFetch.mockRejectedValue(httpErr)

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toMatchObject({ status })
      expect(mockFetch).toHaveBeenCalledTimes(1)

      errorSpy.mockRestore()
    },
  )

  it('AbortError 는 재시도하지 않는다', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    mockFetch.mockRejectedValue(abortErr)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toMatchObject({ name: 'AbortError' })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('알 수 없는 에러 형태는 재시도하지 않는다 (보수적)', async () => {
    mockFetch.mockRejectedValue(new Error('unknown'))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toThrow('unknown')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('timeoutMs 초과 시 AbortError 로 reject 한다', async () => {
    let abortedFlag = false
    mockFetch.mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
      const p = new Promise<never>((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          abortedFlag = true
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        }, { once: true })
      })
      return p
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const promise = ssrFetch('/api/slow', { timeoutMs: 100, retries: 0 })
    // Attach catch immediately so rejection is never unhandled
    let caughtErr: unknown
    const guarded = promise.catch((e) => { caughtErr = e })

    await vi.advanceTimersByTimeAsync(150)
    await guarded

    expect(caughtErr).toMatchObject({ name: 'AbortError' })
    expect(abortedFlag).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('재시도 간 지수 백오프 + 지터 (base 100 → 100~200ms, 200~400ms)', async () => {
    const connErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)
      .mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 100, retries: 2 })
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(400)

    const result = await promise
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(warnSpy).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })
})
