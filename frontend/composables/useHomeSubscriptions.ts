import { readonly, computed } from 'vue'

export interface HomeSubscriptionItem {
  id: number
  houseName: string
  regionName: string
  totalSupplyCount: number | null
  receptionStartDate: string | null
  receptionEndDate: string | null
  status: 'ongoing' | 'upcoming' | 'closed'
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

const EMPTY: ApiListResponse = Object.freeze({
  success: false,
  data: Object.freeze({ items: Object.freeze([]) as HomeSubscriptionItem[], total: 0, page: 1, totalPages: 0 }),
})

/**
 * 홈 "청약 한눈에" 타임라인용.
 * 접수중(마감 임박순) + 예정(시작 임박순) 각 5건 + 총 건수.
 * SSR 블로킹 (above-the-fold CLS 방지).
 */
export function useHomeSubscriptions() {
  const apiBase = useApiBase()

  const fetchByStatus = (status: 'ongoing' | 'upcoming', sort: 'deadline' | 'startSoon') =>
    $fetch<ApiListResponse>(`${apiBase}/api/subscription`, {
      query: { status, sort, limit: 5, page: 1 },
    }).catch(() => EMPTY)

  const asyncState = useAsyncData('home-subscriptions', async () => {
    const [ongoingRes, upcomingRes] = await Promise.all([
      fetchByStatus('ongoing', 'deadline'),
      fetchByStatus('upcoming', 'startSoon'),
    ])
    return {
      ongoing: ongoingRes.data?.items ?? [],
      upcoming: upcomingRes.data?.items ?? [],
      ongoingTotal: ongoingRes.data?.total ?? 0,
      upcomingTotal: upcomingRes.data?.total ?? 0,
    }
  })

  const ongoing = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.ongoing ?? [])
  const upcoming = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.upcoming ?? [])
  const ongoingTotal = computed(() => asyncState.data.value?.ongoingTotal ?? 0)
  const upcomingTotal = computed(() => asyncState.data.value?.upcomingTotal ?? 0)
  const hasAny = computed(() => ongoing.value.length > 0 || upcoming.value.length > 0)

  return {
    ongoing: readonly(ongoing),
    upcoming: readonly(upcoming),
    ongoingTotal: readonly(ongoingTotal),
    upcomingTotal: readonly(upcomingTotal),
    hasAny: readonly(hasAny),
  }
}
