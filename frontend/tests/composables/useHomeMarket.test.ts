import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useHomeMarket } from '~/composables/useHomeMarket'

function market(label: string, total = 1) {
  return {
    region: { city: null, district: null, label },
    window: { from: '2026-08-23', to: '2026-09-21' },
    generatedAt: '2026-09-21T00:00:00.000Z',
    counts: {
      apt: { status: 'ok', data: { total, daily: [{ date: '2026-09-21', count: total }] } },
      villa: { status: 'ok', data: { total: 0, daily: [] } },
      offitel: { status: 'ok', data: { total: 0, daily: [] } },
    },
    recent: { status: 'ok', data: [] },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const cookieRef = ref<unknown>(undefined)

type HomeMarketTestGlobal = typeof globalThis & {
  useApiBase: Mock
  useCookie: Mock
  useAsyncData: Mock
  $fetch: Mock
}

const testGlobal = globalThis as HomeMarketTestGlobal

beforeEach(() => {
  cookieRef.value = undefined
  testGlobal.useApiBase = vi.fn(() => 'http://api')
  testGlobal.useCookie = vi.fn(() => cookieRef)
  testGlobal.useAsyncData = vi.fn((_key: unknown, handler: () => Promise<unknown>) => {
    const data = ref<unknown>(null)
    const pending = ref(true)
    const error = ref<unknown>(null)
    handler()
      .then((result) => {
        data.value = result
      })
      .catch((err) => {
        error.value = err
      })
      .finally(() => {
        pending.value = false
      })
    return { data, pending, error, refresh: vi.fn() }
  })
})

describe('useHomeMarket', () => {
  it('정규화한 쿠키 지역을 useAsyncData key와 첫 요청 query에 반영한다', async () => {
    cookieRef.value = { city: '서울', district: '강남구' }
    const fetchCalls: Array<{ url: string; query?: Record<string, unknown> }> = []
    testGlobal.$fetch = vi.fn((url: string, opts: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts.query })
      return Promise.resolve({ success: true, data: market('서울 강남구') })
    })

    const state = useHomeMarket()
    await flushPromises()

    expect(state.region.value).toEqual({ city: 'seoul', district: 'gangnam' })
    expect(testGlobal.useAsyncData).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'home-market:seoul:gangnam' }),
      expect.any(Function),
      expect.objectContaining({ default: expect.any(Function) }),
    )
    expect(fetchCalls[0]).toMatchObject({
      url: 'http://api/api/real-estate/home-market',
      query: { city: 'seoul', district: 'gangnam' },
    })
  })



  it('쿠키에 유효 도시와 잘못된 시군구가 같이 저장되면 전국으로 초기화한다', async () => {
    cookieRef.value = { city: 'seoul', district: 'haeundae' }
    const fetchCalls: Array<{ url: string; query?: Record<string, unknown> }> = []
    testGlobal.$fetch = vi.fn((url: string, opts: { query?: Record<string, unknown> }) => {
      fetchCalls.push({ url, query: opts.query })
      return Promise.resolve({ success: true, data: market('전국') })
    })

    const state = useHomeMarket()
    await flushPromises()

    expect(state.region.value).toEqual({ city: null, district: null })
    expect(testGlobal.useAsyncData).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'home-market:all:all' }),
      expect.any(Function),
      expect.objectContaining({ default: expect.any(Function) }),
    )
    expect(fetchCalls[0]).toMatchObject({ query: {} })
  })

  it('전국 기본값은 매 방문마다 쿠키를 새로 쓰지 않는다', async () => {
    testGlobal.$fetch = vi.fn(() => Promise.resolve({ success: true, data: market('전국') }))

    useHomeMarket()
    await flushPromises()

    expect(cookieRef.value).toBeUndefined()
  })

  it('늦게 도착한 이전 지역 응답은 최신 선택 결과를 덮어쓰지 않는다', async () => {
    const first = deferred<{ success: true; data: ReturnType<typeof market> }>()
    const second = deferred<{ success: true; data: ReturnType<typeof market> }>()
    const third = deferred<{ success: true; data: ReturnType<typeof market> }>()
    const abortSignals: AbortSignal[] = []
    testGlobal.$fetch = vi
      .fn()
      .mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
        abortSignals.push(opts.signal)
        return first.promise
      })
      .mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
        abortSignals.push(opts.signal)
        return second.promise
      })
      .mockImplementationOnce((_url: string, opts: { signal: AbortSignal }) => {
        abortSignals.push(opts.signal)
        return third.promise
      })

    const state = useHomeMarket()
    first.resolve({ success: true, data: market('전국') })
    await flushPromises()

    const slow = state.setRegion('seoul', 'gangnam')
    const fast = state.setRegion('busan', 'haeundae')
    expect(state.data.value).toBeNull()
    expect(abortSignals[1].aborted).toBe(true)

    third.resolve({ success: true, data: market('부산 해운대구', 3) })
    await fast
    second.resolve({ success: true, data: market('서울 강남구', 2) })
    await slow

    expect(state.region.value).toEqual({ city: 'busan', district: 'haeundae' })
    expect(state.data.value?.region.label).toBe('부산 해운대구')
    expect(state.error.value).toBeNull()
  })

  it('쿠키 저장이 실패해도 현재 지역 ref와 조회는 갱신한다', async () => {
    const failingCookie = {
      get value() {
        return undefined
      },
      set value(_next: unknown) {
        throw new Error('cookie disabled')
      },
    }
    testGlobal.useCookie = vi.fn(() => failingCookie)
    testGlobal.$fetch = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: market('전국') })
      .mockResolvedValueOnce({ success: true, data: market('서울 강남구') })

    const state = useHomeMarket()
    await flushPromises()
    await state.setRegion('seoul', 'gangnam')

    expect(state.region.value).toEqual({ city: 'seoul', district: 'gangnam' })
    expect(state.data.value?.region.label).toBe('서울 강남구')
    expect(state.error.value).toBeNull()
  })

  it('실패한 지역 전환은 성공처럼 이전 지역 데이터를 남기지 않는다', async () => {
    testGlobal.$fetch = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: market('전국') })
      .mockRejectedValueOnce(new Error('network down'))

    const state = useHomeMarket()
    await flushPromises()
    await state.setRegion('seoul', 'gangnam')

    expect(state.region.value).toEqual({ city: 'seoul', district: 'gangnam' })
    expect(state.data.value).toBeNull()
    expect(state.error.value).toBeInstanceOf(Error)
  })
})
