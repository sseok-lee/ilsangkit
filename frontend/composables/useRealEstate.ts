// @TASK Phase7-1 - 부동산 실거래가 API composable

import type {
  RealEstateType,
  RealEstateSearchResponse,
  ComplexListResponse,
  BuildingInfo,
  RealEstateGroupedResponse,
  AreaGroup,
  StatsResponse,
  PriceAnalysis,
  NearbyResponse,
} from '~/types/realEstate'
import { useApiBase } from '~/composables/useApiBase'

export function useRealEstate() {
  const apiBase = useApiBase()

  async function searchTransactions(
    type: RealEstateType,
    params: {
      city?: string
      district?: string
      bjdCode?: string
      buildingName?: string
      dealYear?: number
      dealMonth?: number
      exclusiveArea?: number
      rentType?: string
      months?: number
      page?: number
      limit?: number
    }
  ): Promise<RealEstateSearchResponse> {
    const query = new URLSearchParams()
    if (params.city) query.set('city', params.city)
    if (params.district) query.set('district', params.district)
    if (params.bjdCode) query.set('bjdCode', params.bjdCode)
    if (params.buildingName) query.set('buildingName', params.buildingName)
    if (params.dealYear) query.set('dealYear', String(params.dealYear))
    if (params.dealMonth) query.set('dealMonth', String(params.dealMonth))
    if (params.exclusiveArea != null) query.set('exclusiveArea', String(params.exclusiveArea))
    if (params.rentType) query.set('rentType', params.rentType)
    if (params.months) query.set('months', String(params.months))
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))

    const res = await $fetch<{ success: boolean; data: RealEstateSearchResponse }>(
      `${apiBase}/api/real-estate/${type}/search?${query.toString()}`
    )
    return res.data
  }

  async function getTransactionStats(
    type: RealEstateType,
    bjdCode: string,
    buildingName?: string,
    months?: number,
    exclusiveArea?: number,
    rentType?: string
  ): Promise<StatsResponse> {
    const query = new URLSearchParams({ bjdCode })
    if (buildingName) query.set('buildingName', buildingName)
    if (months) query.set('months', String(months))
    if (exclusiveArea != null) query.set('exclusiveArea', String(exclusiveArea))
    if (rentType) query.set('rentType', rentType)

    const res = await $fetch<{ success: boolean; data: StatsResponse }>(
      `${apiBase}/api/real-estate/${type}/stats?${query.toString()}`
    )
    return res.data
  }

  async function getComplexList(
    type: RealEstateType,
    city?: string,
    district?: string,
    buildingName?: string,
    page: number = 1,
    limit: number = 15
  ): Promise<ComplexListResponse> {
    const query = new URLSearchParams()
    if (city) query.set('city', city)
    if (district) query.set('district', district)
    if (buildingName) query.set('buildingName', buildingName)
    query.set('page', String(page))
    query.set('limit', String(limit))

    const res = await $fetch<{ success: boolean; data: ComplexListResponse }>(
      `${apiBase}/api/real-estate/${type}/complexes?${query.toString()}`
    )
    return res.data
  }

  async function getBuildingInfo(
    type: RealEstateType,
    bjdCode: string,
    buildingName: string
  ): Promise<BuildingInfo | null> {
    const query = new URLSearchParams({ bjdCode, buildingName })

    try {
      const res = await $fetch<{ success: boolean; data: BuildingInfo }>(
        `${apiBase}/api/real-estate/${type}/building-info?${query.toString()}`
      )
      return res.data
    } catch (err) {
      const status = (err as { statusCode?: number; status?: number }).statusCode
        ?? (err as { status?: number }).status
      // 진짜 없는 건물(404)만 null. 5xx/timeout/network(status 없음 포함)는 일시 장애로 전파.
      if (status === 404) return null
      throw err
    }
  }

  async function getAreaGroups(
    type: RealEstateType,
    bjdCode: string,
    buildingName?: string
  ): Promise<AreaGroup[]> {
    const query = new URLSearchParams({ bjdCode })
    if (buildingName) query.set('buildingName', buildingName)

    const res = await $fetch<{ success: boolean; data: AreaGroup[] }>(
      `${apiBase}/api/real-estate/${type}/area-groups?${query.toString()}`
    )
    return res.data
  }

  async function searchAll(
    keyword?: string,
    city?: string,
    district?: string
  ): Promise<RealEstateGroupedResponse> {
    const query = new URLSearchParams()
    if (keyword) query.set('keyword', keyword)
    if (city) query.set('city', city)
    if (district) query.set('district', district)

    const res = await $fetch<{ success: boolean; data: RealEstateGroupedResponse }>(
      `${apiBase}/api/real-estate/search?${query.toString()}`
    )
    return res.data
  }

  async function getApartmentPriceAnalysis(
    bjdCode: string,
    buildingName: string,
  ): Promise<PriceAnalysis | null> {
    const query = new URLSearchParams({ bjdCode, buildingName })
    try {
      const res = await $fetch<{ success: boolean; data: PriceAnalysis | null }>(
        `${apiBase}/api/real-estate/price-analysis?${query.toString()}`,
      )
      return res.data
    } catch {
      return null
    }
  }

  async function getNearby(
    bjdCode: string,
    mode: 'sale' | 'rent',
    opts: {
      rentType?: 'all' | 'jeonse' | 'wolse'
      dongName?: string
      excludeBuildingName?: string
      limitPerType?: number
    } = {}
  ): Promise<NearbyResponse> {
    const query = new URLSearchParams({ bjdCode, mode })
    if (mode === 'rent' && opts.rentType) query.set('rentType', opts.rentType)
    if (opts.dongName) query.set('dongName', opts.dongName)
    if (opts.excludeBuildingName) query.set('excludeBuildingName', opts.excludeBuildingName)
    if (opts.limitPerType) query.set('limitPerType', String(opts.limitPerType))

    const res = await $fetch<{ success: boolean; data: NearbyResponse }>(
      `${apiBase}/api/real-estate/nearby?${query.toString()}`
    )
    return res.data
  }

  return {
    searchTransactions,
    getTransactionStats,
    getComplexList,
    getBuildingInfo,
    searchAll,
    getAreaGroups,
    getApartmentPriceAnalysis,
    getNearby,
  }
}
