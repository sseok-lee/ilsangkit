export const LAND_SLUG = 'land' as const;

export interface LandRegionSummary {
  bjdCode: string;
  dongName: string;
  city: string;
  district: string;
  transactionCount: number;
  recentCount: number;
  avgPricePerPyeong: number | null;
  latestDealDate: string | null;
  isIndexable: boolean;
  jimokBreakdown: Record<string, number>;
}

export interface LandTransaction {
  id: number;
  jibun: string | null;
  jimok: string | null;
  landUse: string | null;
  dealArea: number | null;
  shareDeal: boolean;
  dealAmount: number;
  dealType: string | null;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
  pricePerPyeong: number | null;
}

export interface LandTimelinePoint {
  year: number;
  month: number;
  avgPricePerPyeong: number | null;
  count: number;
}

export interface LandRegionListResult {
  items: LandRegionSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface LandRegionDetailResult {
  items: LandTransaction[];
  total: number;
  page: number;
  totalPages: number;
  jimokDistribution: Array<{ jimok: string; count: number }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: LandTimelinePoint[];
}

export interface LandHubSummary {
  cities: Array<{ slug: string; city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export function isLandIndexable(r: Pick<LandRegionSummary, 'isIndexable'>): boolean {
  return r.isIndexable === true;
}

export function pyeongToSqm(pricePerPyeong: number | null): number | null {
  return pricePerPyeong == null ? null : Math.round((pricePerPyeong / 3.305) * 100) / 100;
}
