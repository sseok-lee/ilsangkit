import type { Subscription, SubscriptionUnitType, SubscriptionCompetition, SubscriptionScore, SubscriptionSpecialStatus, SubscriptionSourceType } from '~/types/subscription'

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

export interface CompetitionRankItem {
  subscriptionId: number
  houseName: string
  regionName: string
  sourceType: SubscriptionSourceType
  winnerDate: string | null
  maxRate?: number | null
  totalApplicants?: number | null
  totalSupply?: number | null
  minCut?: number | null
  maxCut?: number | null
  avgCut?: number | null
}

export interface CompetitionRankResponse {
  items: CompetitionRankItem[]
  total: number
  page: number
  totalPages: number
}

export function useSubscription() {
  const apiBase = useApiBase()

  async function getSubscriptionList(params: {
    status?: 'upcoming' | 'ongoing' | 'closed'
    region?: string
    houseType?: string
    rentType?: string
    sourceType?: SubscriptionSourceType
    category?: 'sale' | 'rent'
    page?: number
    limit?: number
  }): Promise<SubscriptionListResponse> {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.region) query.set('region', params.region)
    if (params.houseType) query.set('houseType', params.houseType)
    if (params.rentType) query.set('rentType', params.rentType)
    if (params.sourceType) query.set('sourceType', params.sourceType)
    if (params.category) query.set('category', params.category)
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

  async function getCompetitionRanking(params: {
    metric?: 'rate' | 'score'
    region?: string
    sourceType?: SubscriptionSourceType
    page?: number
    limit?: number
  }): Promise<CompetitionRankResponse> {
    const query = new URLSearchParams()
    if (params.metric) query.set('metric', params.metric)
    if (params.region) query.set('region', params.region)
    if (params.sourceType) query.set('sourceType', params.sourceType)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: CompetitionRankResponse }>(
      `${apiBase}/api/subscription/competition?${query.toString()}`
    )
    return res.data
  }

  return {
    getSubscriptionList,
    getSubscriptionDetail,
    getUpcomingSubscriptions,
    getCompetitionRanking,
  }
}
