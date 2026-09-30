import type {
  AreaGroup,
  BuildingInfo,
  NearbyResponse,
  RealEstateSearchResponse,
  StatsSummary,
  TransactionStats,
} from '~/types/realEstate'
import type { DetailOverview, DetailSnapshot } from '~/types/housingRedesign'

export interface RealEstateDetailData {
  bjdCode: string
  overview?: DetailOverview | null
  snapshot?: DetailSnapshot | null
  statsResponse: {
    monthly: TransactionStats[]
    summary: StatsSummary | null
  }
  transactions: RealEstateSearchResponse
  buildingInfo: BuildingInfo | null
  areaGroups: AreaGroup[]
  facilitySummary?: string | null
  nearby?: NearbyResponse
  nearbyLoaded?: boolean
  infoFetchFailed?: boolean
}

export function hasUsableRealEstateDetailData(
  data?: Partial<RealEstateDetailData> | null
): boolean {
  if (!data) return false
  if (data.snapshot) return true
  if (data.overview) return true
  if (data.buildingInfo) return true
  if ((data.areaGroups?.length ?? 0) > 0) return true
  if ((data.transactions?.total ?? 0) > 0) return true

  return (data.statsResponse?.summary?.totalCount ?? 0) > 0
}
