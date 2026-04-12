// @TASK Phase8 - 청약 API composable

import type { Subscription, SubscriptionUnitType } from '~/types/subscription'

export interface SubscriptionListResponse {
  items: Subscription[]
  total: number
  page: number
  totalPages: number
}

export type SubscriptionDetailResponse = Subscription & {
  unitTypes: SubscriptionUnitType[]
}

export function useSubscription() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  async function getSubscriptionList(params: {
    status?: 'upcoming' | 'ongoing' | 'closed'
    region?: string
    houseType?: string
    page?: number
    limit?: number
  }): Promise<SubscriptionListResponse> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.region) query.set('region', params.region)
    if (params.houseType) query.set('houseType', params.houseType)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: SubscriptionListResponse }>(
      `${apiBase}/api/subscription?${query.toString()}`
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
