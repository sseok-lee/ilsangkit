import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useWasteList } from '~/composables/useWasteList'
import type { WasteListQuery } from '~/types/wasteList'

const getSchedules = vi.fn()

vi.mock('~/composables/useWasteSchedule', () => ({
  useWasteSchedule: () => ({ getSchedules }),
}))

describe('useWasteList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers one keyed async-data source and forwards query plus AbortSignal', async () => {
    const query: WasteListQuery = { areaId: 2, keyword: '예미2길', page: 2, limit: 20 }
    const signal = new AbortController().signal
    getSchedules.mockResolvedValue({ schedules: [], total: 0, page: 2, totalPages: 1 })
    const useAsyncDataMock = vi.fn((key, handler, options) => {
      const state = {
        data: ref(null),
        error: ref(null),
        status: ref('idle'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      state.refresh = vi.fn(async () => {
        state.data.value = await handler(null, { signal })
      })
      return Object.assign(Promise.resolve(state), state)
    })
    vi.stubGlobal('useAsyncData', useAsyncDataMock)

    const list = useWasteList({ active: () => true, query: () => query })
    await list.state.refresh()

    expect(useAsyncDataMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Function),
      expect.objectContaining({ dedupe: 'cancel', timeout: 8000 })
    )
    expect(getSchedules).toHaveBeenCalledWith(query, signal)
    expect(list.key.value).toContain('"areaId":2')
  })

  it('renders only the envelope whose request key is current', () => {
    const currentQuery = ref<WasteListQuery>({ areaId: 2, page: 1, limit: 20 })
    const staleEnvelope = {
      requestKey: 'waste-list:{"city":null,"district":null,"areaId":1,"keyword":null,"coverage":null,"page":1,"limit":20}',
      result: { schedules: [{ id: 1 }], total: 1, page: 1, totalPages: 1 },
    }
    vi.stubGlobal('useAsyncData', vi.fn(() => {
      const state = {
        data: ref(staleEnvelope),
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(state), state)
    }))

    const list = useWasteList({ active: () => true, query: () => currentQuery.value })
    expect(list.result.value).toBeNull()

    currentQuery.value = { areaId: 1, page: 1, limit: 20 }
    expect(list.result.value).toEqual(staleEnvelope.result)
  })

  it('reuses successful SSR payload without issuing a second source request', () => {
    const result = { schedules: [], total: 0, page: 1, totalPages: 1 }
    const envelope = {
      requestKey: 'waste-list:{"city":null,"district":null,"areaId":2,"keyword":null,"coverage":null,"page":1,"limit":20}',
      result,
    }
    vi.stubGlobal('useAsyncData', vi.fn((_key, _handler) => {
      const state = {
        data: ref(envelope),
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(state), state)
    }))

    const list = useWasteList({ active: () => true, query: () => ({ areaId: 2, page: 1, limit: 20 }) })

    expect(list.result.value).toEqual(result)
    expect(getSchedules).not.toHaveBeenCalled()
  })

  it('keeps source fetch rejections at the Nuxt async-data error boundary', async () => {
    const error = new Error('network')
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = {
        data: ref(null),
        error: ref<Error | null>(null),
        status: ref('idle'),
        pending: ref(false),
        refresh: vi.fn(async () => {
          try {
            await handler(null, { signal: new AbortController().signal })
          } catch (e) {
            state.error.value = e as Error
            state.status.value = 'error'
          }
        }),
      }
      return Object.assign(Promise.resolve(state), state)
    }))
    getSchedules.mockRejectedValue(error)

    const list = useWasteList({ active: () => true, query: () => ({ areaId: 2, page: 1, limit: 20 }) })
    await list.state.refresh()

    expect(list.state.error.value).toBe(error)
    expect(list.result.value).toBeNull()
  })

  it('ignores an old request after a newer request becomes current', () => {
    const latest = { schedules: [{ id: 2 }], total: 1, page: 1, totalPages: 1 }
    const key = computed(() => 'waste-list:{"city":null,"district":null,"areaId":2,"keyword":null,"coverage":null,"page":1,"limit":20}')
    vi.stubGlobal('useAsyncData', vi.fn(() => {
      const state = {
        data: ref({ requestKey: key.value, result: latest }),
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(state), state)
    }))

    const list = useWasteList({ active: () => true, query: () => ({ areaId: 2, page: 1, limit: 20 }) })

    expect(list.result.value).toEqual(latest)
  })

  it('keeps request B rendered when request A completes after B', () => {
    const currentQuery = ref<WasteListQuery>({ areaId: 1, page: 1, limit: 20 })
    const data = ref<unknown>(null)
    vi.stubGlobal('useAsyncData', vi.fn(() => {
      const state = {
        data,
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(state), state)
    }))
    const list = useWasteList({ active: () => true, query: () => currentQuery.value })

    currentQuery.value = { areaId: 2, page: 1, limit: 20 }
    const requestB = {
      requestKey: 'waste-list:{"city":null,"district":null,"areaId":2,"keyword":null,"coverage":null,"page":1,"limit":20}',
      result: { schedules: [{ id: 2 }], total: 1, page: 1, totalPages: 1 },
    }
    const requestA = {
      requestKey: 'waste-list:{"city":null,"district":null,"areaId":1,"keyword":null,"coverage":null,"page":1,"limit":20}',
      result: { schedules: [{ id: 1 }], total: 1, page: 1, totalPages: 1 },
    }

    data.value = requestB
    expect(list.result.value).toEqual(requestB.result)

    data.value = requestA
    expect(list.result.value).toBeNull()
  })
})
