import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useHomeSubscriptions, type HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'

const fetchCalls: Array<Record<string, unknown>> = []

function item(
  id: number,
  overrides: Partial<HomeSubscriptionItem> = {},
): HomeSubscriptionItem {
  return {
    id,
    houseName: `공고 ${id}`,
    regionName: '전국',
    totalSupplyCount: 100,
    receptionStartDate: '2026-05-20',
    receptionEndDate: '2026-05-25',
    status: 'ongoing',
    sourceType: 'APT',
    rentType: null,
    ...overrides,
  }
}

function response(items: HomeSubscriptionItem[]) {
  return Promise.resolve({
    success: true,
    data: {
      items,
      total: items.length,
      page: 1,
      totalPages: 1,
    },
  })
}

beforeEach(() => {
  fetchCalls.length = 0
  ;(globalThis as any).useApiBase = () => 'http://api'
  ;(globalThis as any).$fetch = vi.fn((_url: string, opts: { query: Record<string, unknown> }) => {
    fetchCalls.push(opts.query)
    const { category, status } = opts.query

    if (category === 'sale' && status === 'ongoing') {
      return response([
        item(1, { houseName: '분양 접수중 1' }),
        item(2, { houseName: '분양 접수중 첫번째' }),
        item(2, { houseName: '분양 접수중 중복 두번째' }),
        item(99, { houseName: '잘못 섞인 공공임대', rentType: '분양전환 가능임대' }),
      ])
    }
    if (category === 'sale' && status === 'upcoming') {
      return response([
        item(3, { houseName: '분양 예정 1', status: 'upcoming' }),
        item(4, { houseName: '분양 예정 2', status: 'upcoming' }),
      ])
    }
    if (category === 'rent' && status === 'ongoing') {
      return response([
        item(99, { houseName: '공공임대 우선', rentType: '분양전환 가능임대' }),
        item(10, { houseName: '공공임대 접수중', rentType: '분양전환 불가임대' }),
        item(14, { houseName: '마이홈 공공임대 접수중', sourceType: 'PUBLIC_RENT', rentType: '국민임대' }),
        item(15, { houseName: '일정 확인 필요 공고', sourceType: 'PUBLIC_RENT', rentType: '매입임대', status: 'unknown' as any }),
        item(11, { houseName: '민간임대 오염 데이터', sourceType: 'PRIVATE_RENT', rentType: null }),
      ])
    }
    if (category === 'rent' && status === 'upcoming') {
      return response([
        item(12, { houseName: '공공임대 예정 1', status: 'upcoming', rentType: '분양전환 가능임대' }),
        item(13, { houseName: '마이홈 공공임대 예정', status: 'upcoming', sourceType: 'PUBLIC_RENT', rentType: '행복주택' }),
      ])
    }
    return response([])
  })
  ;(globalThis as any).useAsyncData = (_key: string, handler: () => Promise<unknown>) => {
    const data = ref<unknown>(null)
    const pending = ref(true)
    const refresh = vi.fn()
    handler().then((r) => {
      data.value = r
      pending.value = false
    })
    return { data, pending, error: ref(null), refresh }
  }
})

describe('useHomeSubscriptions', () => {
  it('일반 청약과 공공임대의 접수중/예정 네 요청을 정확한 쿼리로 병렬 실행한다', async () => {
    useHomeSubscriptions()
    await flushPromises()

    expect(fetchCalls).toHaveLength(4)
    expect(fetchCalls).toEqual(expect.arrayContaining([
      { category: 'sale', status: 'ongoing', sort: 'deadline', limit: 3, page: 1 },
      { category: 'sale', status: 'upcoming', sort: 'startSoon', limit: 3, page: 1 },
      { category: 'rent', rentType: '임대주택', status: 'ongoing', sort: 'deadline', limit: 3, page: 1 },
      { category: 'rent', rentType: '임대주택', status: 'upcoming', sort: 'startSoon', limit: 3, page: 1 },
    ]))
    expect(fetchCalls.some((query) => 'region' in query)).toBe(false)
  })

  it('패널별 접수중 우선·first-wins 중복 제거·3개 제한을 적용하고 공공임대 id를 일반 청약에서 제거한다', async () => {
    const { sale, publicRent } = useHomeSubscriptions()
    await flushPromises()

    expect(publicRent.value.map((entry) => entry.id)).toEqual([99, 10, 14])
    expect(sale.value.map((entry) => entry.id)).toEqual([1, 2, 3])
    expect(sale.value.find((entry) => entry.id === 2)?.houseName).toBe('분양 접수중 첫번째')
    expect(sale.value.some((entry) => entry.id === 99)).toBe(false)
  })

  it('공공임대 패널은 실제 정규화된 공공임대 분류만 노출하고 PRIVATE_RENT를 배제한다', async () => {
    const { publicRent } = useHomeSubscriptions()
    await flushPromises()

    expect(publicRent.value.map((entry) => entry.sourceType)).toEqual(expect.arrayContaining(['APT', 'PUBLIC_RENT']))
    expect(publicRent.value.every((entry) => entry.sourceType === 'APT' || entry.sourceType === 'PUBLIC_RENT')).toBe(true)
    expect(publicRent.value.some((entry) => entry.sourceType === 'PRIVATE_RENT')).toBe(false)
    expect(publicRent.value.some((entry) => entry.status === 'unknown')).toBe(false)
  })

  it('한 패널 실패와 실제 빈 목록을 구분한다', async () => {
    ;(globalThis as any).$fetch = vi.fn((_url: string, opts: { query: Record<string, unknown> }) => {
      fetchCalls.push(opts.query)
      if (opts.query.category === 'sale') return Promise.reject(new Error('sale unavailable'))
      return response([])
    })

    const { sale, publicRent, saleError, publicRentError } = useHomeSubscriptions()
    await flushPromises()

    expect(sale.value).toEqual([])
    expect(publicRent.value).toEqual([])
    expect(saleError.value).toBe(true)
    expect(publicRentError.value).toBe(false)
  })

  it('노출 상태와 refresh는 useAsyncData 상태를 전달한다', async () => {
    const { pending, refresh } = useHomeSubscriptions()
    expect(pending.value).toBe(true)
    await flushPromises()
    expect(pending.value).toBe(false)
    refresh()
    expect(refresh).toHaveBeenCalled()
  })
})
