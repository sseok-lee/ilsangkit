import type { Subscription, SubscriptionUnitType, SubscriptionCompetition, SubscriptionScore, SubscriptionSpecialStatus, SubscriptionSourceType } from '~/types/subscription'
import type { SubscriptionApiSort } from '~/types/subscriptionList'

export interface SubscriptionListResponse {
  items: Subscription[]
  total: number
  page: number
  totalPages: number
}

export type SubscriptionDetailResponse = Subscription & {
  unitTypes: SubscriptionUnitType[]
  competitions: SubscriptionCompetition[]
  scores: SubscriptionScore[]
  specialStatuses: SubscriptionSpecialStatus[]
}

export function useSubscription() {
  const apiBase = useApiBase()

  async function getSubscriptionList(params: {
    status?: 'upcoming' | 'ongoing' | 'closed' | 'unknown'
    region?: string
    houseType?: string
    rentType?: string
    sourceType?: SubscriptionSourceType
    category?: 'sale' | 'rent'
    q?: string
    sort?: SubscriptionApiSort
    page?: number
    limit?: number
  }, options?: { signal?: AbortSignal }): Promise<SubscriptionListResponse> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.region) query.set('region', params.region)
    if (params.houseType) query.set('houseType', params.houseType)
    if (params.rentType) query.set('rentType', params.rentType)
    if (params.sourceType) query.set('sourceType', params.sourceType)
    if (params.category) query.set('category', params.category)
    if (params.q) query.set('q', params.q)
    if (params.sort) query.set('sort', params.sort)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: SubscriptionListResponse }>(
      `${apiBase}/api/subscription?${query.toString()}`,
      { signal: options?.signal },
    )
    return res.data
  }

  async function getSubscriptionDetail(id: number): Promise<SubscriptionDetailResponse> {
    const res = await $fetch<{ success: boolean; data: SubscriptionDetailResponse }>(
      `${apiBase}/api/subscription/${id}`
    )
    return res.data
  }

  async function getUpcomingSubscriptions(): Promise<Subscription[]> {
    const res = await $fetch<{ success: boolean; data: Subscription[] }>(
      `${apiBase}/api/subscription/upcoming`
    )
    return res.data
  }

  return {
    getSubscriptionList,
    getSubscriptionDetail,
    getUpcomingSubscriptions,
  }
}
