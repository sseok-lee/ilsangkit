import type {
  AreaGroup,
  BuildingInfo,
  RealEstateSearchResponse,
  StatsSummary,
  TransactionStats,
} from '~/types/realEstate'

export interface RealEstateDetailData {
  bjdCode: string
  statsResponse: {
    monthly: TransactionStats[]
    summary: StatsSummary | null
  }
  transactions: RealEstateSearchResponse
  buildingInfo: BuildingInfo | null
  areaGroups: AreaGroup[]
}

export function hasUsableRealEstateDetailData(
  data?: Partial<RealEstateDetailData> | null
): boolean {
  if (!data) return false
  if (data.buildingInfo) return true
  if ((data.areaGroups?.length ?? 0) > 0) return true
  if ((data.transactions?.total ?? 0) > 0) return true

  return (data.statsResponse?.summary?.totalCount ?? 0) > 0
}
