import type {
  LandRegionListResult,
  LandRegionDetailResult,
  LandHubSummary,
  LandTransactionsResult,
} from '~/types/land'
import { useApiBase } from '~/composables/useApiBase'

export function useLand() {
  const apiBase = useApiBase()

  async function getRegions(params: {
    city?: string
    district?: string
    /** 지정 시 그 동 하나만 조회. 상세 페이지가 목록 창에 갇히지 않게 한다. */
    dongName?: string
    page?: number
    limit?: number
  }): Promise<LandRegionListResult> {
    const query = new URLSearchParams()
    if (params.city) query.set('city', params.city)
    if (params.district) query.set('district', params.district)
    if (params.dongName) query.set('dongName', params.dongName)
    if (params.page != null) query.set('page', String(params.page))
    if (params.limit != null) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: LandRegionListResult }>(
      `${apiBase}/api/real-estate/land/regions?${query.toString()}`
    )
    return res.data
  }

  async function getRegionDetail(params: {
    bjdCode: string
    dongName: string
    months?: number
    page?: number
    limit?: number
  }): Promise<LandRegionDetailResult> {
    const query = new URLSearchParams()
    query.set('bjdCode', params.bjdCode)
    query.set('dongName', params.dongName)
    if (params.months != null) query.set('months', String(params.months))
    if (params.page != null) query.set('page', String(params.page))
    if (params.limit != null) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: LandRegionDetailResult }>(
      `${apiBase}/api/real-estate/land/region?${query.toString()}`
    )
    return res.data
  }

  async function getHubSummary(): Promise<LandHubSummary> {
    const res = await $fetch<{ success: boolean; data: LandHubSummary }>(
      `${apiBase}/api/real-estate/land/hub-summary`
    )
    return res.data
  }

  async function getTransactions(params: {
    bjdCode: string
    dongName: string
    page?: number
    limit?: number
  }): Promise<LandTransactionsResult> {
    const query = new URLSearchParams()
    query.set('bjdCode', params.bjdCode)
    query.set('dongName', params.dongName)
    if (params.page != null) query.set('page', String(params.page))
    if (params.limit != null) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: LandTransactionsResult }>(
      `${apiBase}/api/real-estate/land/transactions?${query.toString()}`
    )
    return res.data
  }

  return {
    getRegions,
    getRegionDetail,
    getHubSummary,
    getTransactions,
  }
}
