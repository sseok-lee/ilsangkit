import { readonly, computed } from 'vue'

export interface HomeSubscriptionItem {
  id: number
  houseName: string
  regionName: string
  totalSupplyCount: number | null
  receptionStartDate: string | null
  receptionEndDate: string | null
  status: 'ongoing' | 'upcoming' | 'closed'
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

/**
 * 홈 "청약·임대 일정" 섹션용.
 * /api/subscription?status=ongoing&limit=2  +  ?status=upcoming&limit=2 를 병렬 페치.
 * SSR 블로킹 (above-the-fold CLS 방지).
 */
export function useHomeSubscriptions() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  const fetchByStatus = (status: 'ongoing' | 'upcoming') =>
    $fetch<ApiListResponse>(`${apiBase}/api/subscription`, {
      query: { status, limit: 4, page: 1 },
    }).catch(() => ({ success: false, data: { items: [], total: 0, page: 1, totalPages: 0 } }) as ApiListResponse)

  const asyncState = useAsyncData('home-subscriptions', async () => {
    const [ongoingRes, upcomingRes] = await Promise.all([
      fetchByStatus('ongoing'),
      fetchByStatus('upcoming'),
    ])
    return {
      ongoing: ongoingRes.data?.items ?? [],
      upcoming: upcomingRes.data?.items ?? [],
    }
  })

  const ongoing = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.ongoing ?? [])
  const upcoming = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.upcoming ?? [])
  const hasAny = computed(() => ongoing.value.length > 0 || upcoming.value.length > 0)

  return {
    ongoing: readonly(ongoing),
    upcoming: readonly(upcoming),
    hasAny: readonly(hasAny),
  }
}
