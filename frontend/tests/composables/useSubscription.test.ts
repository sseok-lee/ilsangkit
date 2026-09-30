import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubscription } from '~/composables/useSubscription'

type FetchMock = ReturnType<typeof vi.fn>

let fetchMock: FetchMock

describe('useSubscription', () => {
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, totalPages: 0 },
    })
    const globals = globalThis as typeof globalThis & {
      useApiBase: () => string
      $fetch: FetchMock
    }
    globals.useApiBase = () => 'http://api.test'
    globals.$fetch = fetchMock
  })

  it('passes q, sort, and abort signal to the subscription list API', async () => {
    const signal = new AbortController().signal
    const { getSubscriptionList } = useSubscription()

    await getSubscriptionList({
      category: 'sale',
      sourceType: 'APT',
      q: '한강',
      sort: 'priority',
      page: 1,
      limit: 20,
    }, { signal })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/subscription?sourceType=APT&category=sale&q=%ED%95%9C%EA%B0%95&sort=priority&page=1&limit=20',
      { signal },
    )
  })

  it('keeps existing list calls working without options', async () => {
    const { getSubscriptionList } = useSubscription()

    await getSubscriptionList({ status: 'ongoing', page: 1, limit: 6 })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/subscription?status=ongoing&page=1&limit=6',
      { signal: undefined },
    )
  })
})
