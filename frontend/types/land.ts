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
  daeCount: number;
  daeNonShareCount: number;
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
  quarter: number;
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
  jimokGroups: Array<{ group: string; count: number; avgPricePerPyeong: number | null }>;
  daeSamples: LandTransaction[];
  daeNonShareCount: number;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: LandTimelinePoint[];
  daeCount: number;
}

export interface LandTransactionsResult {
  items: LandTransaction[];
  total: number;
  page: number;
  totalPages: number;
}

export interface LandHubSummary {
  cities: Array<{ slug: string; city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export function isLandIndexable(r: Pick<LandRegionSummary, 'isIndexable'>): boolean {
  return r.isIndexable === true;
}

export function pyeongToSqm(pricePerPyeong: number | null): number | null {
  return pricePerPyeong == null ? null : Math.round(pricePerPyeong / 3.305);
}

export function formatLandDealDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function formatManwon(value: number | null | undefined): string {
  if (value == null) return '-';
  return Math.round(value).toLocaleString('ko-KR');
}

export function formatManwonKorean(value: number | null | undefined): string {
  if (value == null) return '-';
  const v = Math.round(value);
  if (v >= 10000) {
    const eok = Math.floor(v / 10000);
    const rest = v % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  }
  return `${v.toLocaleString('ko-KR')}만원`;
}
