import { readonly, computed } from 'vue'
import { PUBLIC_RENT_TYPES } from '~/utils/subscriptionMeta'

export interface HomeSubscriptionItem {
  id: number
  houseName: string
  regionName: string
  totalSupplyCount: number | null
  receptionStartDate: string | null
  receptionEndDate: string | null
  status: 'ongoing' | 'upcoming' | 'closed' | 'unknown'
  sourceType: string
  rentType: string | null
}

interface ApiListResponse {
  success: boolean
  data: {
    items: HomeSubscriptionItem[]
    total: number
    page: number
    totalPages: number
  }
}

interface HomeSubscriptionPanelResult {
  sale: HomeSubscriptionItem[]
  publicRent: HomeSubscriptionItem[]
  saleError: boolean
  publicRentError: boolean
}

type QueryStatus = 'ongoing' | 'upcoming'
type QuerySort = 'deadline' | 'startSoon'

interface RequestResult {
  items: HomeSubscriptionItem[]
  error: boolean
}

function uniqueFirst(items: HomeSubscriptionItem[]): HomeSubscriptionItem[] {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function isPublicRentItem(item: HomeSubscriptionItem): boolean {
  if (item.status === 'unknown') return false
  if (item.sourceType === 'PUBLIC_RENT') return true
  return item.sourceType === 'APT' && item.rentType != null && PUBLIC_RENT_TYPES.includes(item.rentType)
}

/**
 * 홈 "청약 한눈에"용.
 * 일반 청약과 공공임대를 나누고, 각 패널은 접수중(마감 임박순) → 예정(시작 임박순) 순서로 3건 노출한다.
 * SSR 블로킹 (above-the-fold CLS 방지).
 */
export function useHomeSubscriptions() {
  const apiBase = useApiBase()

  const fetchList = async (query: Record<string, unknown>): Promise<RequestResult> => {
    try {
      const response = await $fetch<ApiListResponse>(`${apiBase}/api/subscription`, { query })
      return { items: response.data?.items ?? [], error: false }
    } catch {
      return { items: [], error: true }
    }
  }

  const fetchSale = (status: QueryStatus, sort: QuerySort) =>
    fetchList({ category: 'sale', status, sort, limit: 3, page: 1 })

  const fetchPublicRent = (status: QueryStatus, sort: QuerySort) =>
    fetchList({ category: 'rent', rentType: '임대주택', status, sort, limit: 3, page: 1 })

  const asyncState = useAsyncData<HomeSubscriptionPanelResult>('home-subscriptions', async () => {
    const [saleOngoing, saleUpcoming, rentOngoing, rentUpcoming] = await Promise.all([
      fetchSale('ongoing', 'deadline'),
      fetchSale('upcoming', 'startSoon'),
      fetchPublicRent('ongoing', 'deadline'),
      fetchPublicRent('upcoming', 'startSoon'),
    ])

    const rentAll = uniqueFirst([...rentOngoing.items, ...rentUpcoming.items].filter(isPublicRentItem))
    const rentIds = new Set(rentAll.map(item => item.id))
    const saleAll = uniqueFirst([...saleOngoing.items, ...saleUpcoming.items])
      .filter(item => !rentIds.has(item.id))

    return {
      sale: saleAll.slice(0, 3),
      publicRent: rentAll.slice(0, 3),
      saleError: saleOngoing.error || saleUpcoming.error,
      publicRentError: rentOngoing.error || rentUpcoming.error,
    }
  })

  const sale = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.sale ?? [])
  const publicRent = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.publicRent ?? [])
  const saleError = computed(() => asyncState.data.value?.saleError ?? false)
  const publicRentError = computed(() => asyncState.data.value?.publicRentError ?? false)

  return {
    sale: readonly(sale),
    publicRent: readonly(publicRent),
    saleError: readonly(saleError),
    publicRentError: readonly(publicRentError),
    pending: readonly(asyncState.pending),
    refresh: asyncState.refresh,
  }
}
