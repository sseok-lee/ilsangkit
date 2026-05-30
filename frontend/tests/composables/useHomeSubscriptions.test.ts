import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'

const fetchCalls: Array<Record<string, unknown>> = []

beforeEach(() => {
  fetchCalls.length = 0
  ;(globalThis as any).useApiBase = () => 'http://api'
  ;(globalThis as any).$fetch = vi.fn((_url: string, opts: { query: Record<string, unknown> }) => {
    fetchCalls.push(opts.query)
    const status = opts.query.status
    if (status === 'ongoing') {
      return Promise.resolve({
        success: true,
        data: {
          items: [
            { id: 1, houseName: '래미안', regionName: '서울 서초구', totalSupplyCount: 100, receptionStartDate: '2026-05-28', receptionEndDate: '2026-05-31', status: 'ongoing', sourceType: 'APT', rentType: null },
          ],
          total: 7, page: 1, totalPages: 7,
        },
      })
    }
    return Promise.resolve({
      success: true,
      data: {
        items: [
          { id: 2, houseName: 'SK뷰', regionName: '광명', totalSupplyCount: 50, receptionStartDate: '2026-06-05', receptionEndDate: null, status: 'upcoming', sourceType: 'OPTIONAL', rentType: null },
        ],
        total: 3, page: 1, totalPages: 3,
      },
    })
  })
  ;(globalThis as any).useAsyncData = (_key: string, handler: () => Promise<unknown>) => {
    const data = ref<unknown>(null)
    handler().then((r) => { data.value = r })
    return { data, pending: ref(false), error: ref(null), refresh: vi.fn() }
  }
})

describe('useHomeSubscriptions', () => {
  it('접수중은 sort=deadline, 예정은 sort=startSoon, limit=5로 페치한다', async () => {
    useHomeSubscriptions()
    await flushPromises()
    const ongoing = fetchCalls.find((q) => q.status === 'ongoing')
    const upcoming = fetchCalls.find((q) => q.status === 'upcoming')
    expect(ongoing).toMatchObject({ status: 'ongoing', sort: 'deadline', limit: 5, page: 1 })
    expect(upcoming).toMatchObject({ status: 'upcoming', sort: 'startSoon', limit: 5, page: 1 })
  })

  it('응답 total을 ongoingTotal/upcomingTotal로 노출한다', async () => {
    const { ongoingTotal, upcomingTotal } = useHomeSubscriptions()
    await flushPromises()
    expect(ongoingTotal.value).toBe(7)
    expect(upcomingTotal.value).toBe(3)
  })

  it('item에 sourceType/rentType을 담는다', async () => {
    const { ongoing, upcoming } = useHomeSubscriptions()
    await flushPromises()
    expect(ongoing.value[0].sourceType).toBe('APT')
    expect(upcoming.value[0].sourceType).toBe('OPTIONAL')
  })
})
