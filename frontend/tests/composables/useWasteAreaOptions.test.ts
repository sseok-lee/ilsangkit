import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useWasteAreaOptions } from '~/composables/useWasteAreaOptions'
import type { AreaList, AreaSummary } from '~/types/wasteArea'

const list = vi.fn()

vi.mock('~/composables/useWasteAreas', () => ({
  useWasteAreas: () => ({ list }),
}))

function area(areaId: number): AreaSummary {
  return {
    areaId,
    name: `테스트${areaId}동`,
    city: '서울특별시',
    district: '강남구',
    href: `/trash/areas/${areaId}`,
    matchReason: 'exact',
    scheduleCount: 1,
    conditionalCount: 0,
    summary: '',
    dataDate: null,
  }
}

function page(items: AreaSummary[], pageNo: number, totalPages: number, generationId = 'g1'): AreaList {
  return {
    generationId,
    items,
    total: 101,
    page: pageNo,
    totalPages,
    unresolved: { count: 0, href: null },
  }
}

describe('useWasteAreaOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads all regional option pages with limit 100 and dedupes areaId', async () => {
    const signal = new AbortController().signal
    list
      .mockResolvedValueOnce(page([...Array.from({ length: 100 }, (_, index) => area(index + 1)), area(1)], 1, 2))
      .mockResolvedValueOnce(page([area(101), area(1)], 2, 2))
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = { data: ref(null), error: ref(null), status: ref('idle'), pending: ref(false), refresh: vi.fn() }
      state.refresh = vi.fn(async () => {
        state.data.value = await handler(null, { signal })
      })
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => '강남구',
      enabled: () => true,
    })
    await options.state.refresh()

    expect(list).toHaveBeenNthCalledWith(1, { city: '서울특별시', district: '강남구', page: 1, limit: 100 }, signal)
    expect(list).toHaveBeenNthCalledWith(2, { city: '서울특별시', district: '강남구', page: 2, limit: 100 }, signal)
    expect(options.result.value?.items).toHaveLength(101)
  })

  it('retries the whole option load once when generation changes and errors on a second mismatch', async () => {
    list
      .mockResolvedValueOnce(page([area(1)], 1, 2, 'g1'))
      .mockResolvedValueOnce(page([area(2)], 2, 2, 'g2'))
      .mockResolvedValueOnce(page([area(1)], 1, 2, 'g3'))
      .mockResolvedValueOnce(page([area(2)], 2, 2, 'g4'))
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = { data: ref(null), error: ref(null), status: ref('idle'), pending: ref(false), refresh: vi.fn() }
      state.refresh = vi.fn(async () => {
        state.data.value = await handler(null, { signal: new AbortController().signal })
      })
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => '강남구',
      enabled: () => true,
    })

    await expect(options.state.refresh()).rejects.toThrow('WASTE_OPTIONS_GENERATION_CHANGED')
    expect(list).toHaveBeenCalledTimes(4)
  })

  it('uses the retried option set when a generation mismatch resolves on retry', async () => {
    list
      .mockResolvedValueOnce(page([area(1)], 1, 2, 'g1'))
      .mockResolvedValueOnce(page([area(2)], 2, 2, 'g2'))
      .mockResolvedValueOnce(page([area(3)], 1, 2, 'g3'))
      .mockResolvedValueOnce(page([area(4)], 2, 2, 'g3'))
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = { data: ref(null), error: ref(null), status: ref('idle'), pending: ref(false), refresh: vi.fn() }
      state.refresh = vi.fn(async () => {
        state.data.value = await handler(null, { signal: new AbortController().signal })
      })
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => '강남구',
      enabled: () => true,
    })
    await options.state.refresh()

    expect(options.result.value).toEqual({ generationId: 'g3', items: [area(3), area(4)] })
  })

  it('propagates network and payload errors to the async-data boundary', async () => {
    const error = new Error('network')
    list.mockRejectedValue(error)
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = { data: ref(null), error: ref<Error | null>(null), status: ref('idle'), pending: ref(false), refresh: vi.fn() }
      state.refresh = vi.fn(async () => {
        try {
          state.data.value = await handler(null, { signal: new AbortController().signal })
        } catch (e) {
          state.error.value = e as Error
        }
      })
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => '강남구',
      enabled: () => true,
    })
    await options.state.refresh()

    expect(options.state.error.value).toBe(error)
    expect(options.result.value).toBeNull()
  })

  it('does not query options when disabled or missing region fields', async () => {
    vi.stubGlobal('useAsyncData', vi.fn((_key, handler) => {
      const state = { data: ref(null), error: ref(null), status: ref('idle'), pending: ref(false), refresh: vi.fn() }
      state.refresh = vi.fn(async () => {
        state.data.value = await handler(null, { signal: new AbortController().signal })
      })
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => undefined,
      enabled: () => true,
    })
    await options.state.refresh()

    expect(options.result.value).toBeNull()
    expect(list).not.toHaveBeenCalled()
  })

  it('renders only current-region option envelopes', () => {
    vi.stubGlobal('useAsyncData', vi.fn(() => {
      const state = {
        data: ref({
          requestKey: 'waste-area-options:서울특별시:서초구',
          result: { generationId: 'g1', items: [area(1)] },
        }),
        error: ref(null),
        status: ref('success'),
        pending: ref(false),
        refresh: vi.fn(),
      }
      return Object.assign(Promise.resolve(state), state)
    }))

    const options = useWasteAreaOptions({
      city: () => '서울특별시',
      district: () => '강남구',
      enabled: () => true,
    })

    expect(options.result.value).toBeNull()
  })
})
