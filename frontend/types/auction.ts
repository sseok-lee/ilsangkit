export const AUCTION_SLUG = 'auction' as const;
export type UsageGroup = 'residential' | 'land' | 'commercial' | 'industrial' | 'complex' | 'etc';
export type AuctionStatus = 'ongoing' | 'scheduled' | 'closed' | 'sold' | 'failed' | 'cancelled';

export interface AuctionItem {
  id: number; cltrMngNo: string; pbctCdtnNo: string; plnmNo: string | null;
  city: string; district: string; bjdCode: string; dongName: string | null; address: string;
  usage: string | null; usageGroup: UsageGroup; propertyType: string | null; dpslMtdNm: string | null;
  landArea: number | null; bldArea: number | null;
  apslAssAmt: number | null; minBidPrc: number | null; failCnt: number; bidRound: number | null;
  bidBeginDtm: string | null; bidCloseDtm: string | null; orgNm: string | null; pvctTrgtYn: boolean;
  status: AuctionStatus; isClosed: boolean;
  resultType: string | null; winBidPrc: number | null; bidRate: number | null; resultDate: string | null;
  lat: number | null; lng: number | null;
}
export interface AuctionItemsResult { items: AuctionItem[]; total: number; page: number; totalPages: number; }
export interface AuctionItemDetailResult { item: AuctionItem; nearby: AuctionItem[]; }
export interface AuctionAreaSummary {
  bjdCode: string; usageGroup: UsageGroup; city: string; district: string;
  activeCount: number; closedCount: number; soldCount: number;
  avgBidRate: number | null; avgApslAmt: number | null; avgWinBidPrc: number | null;
  failRate: number | null; latestResultDate: string | null; isIndexable: boolean;
}
export interface AuctionRegionDetailResult {
  usageGroups: AuctionAreaSummary[]; activeItems: AuctionItem[]; recentSold: AuctionItem[];
}
export interface AuctionCityDetailResult {
  districts: Array<{ district: string; bjdCode: string; activeCount: number; soldCount: number; isIndexable: boolean }>;
}
export interface AuctionHubSummary { totalActive: number; totalSold: number; regionCount: number; }

export const USAGE_GROUP_LABEL: Record<UsageGroup, string> = {
  residential: '아파트·주거용', land: '토지', commercial: '상가·업무', industrial: '공장·창고', complex: '복합', etc: '기타',
};

export function formatWon(v: number | null | undefined): string {
  if (v == null) return '-';
  return Math.round(v).toLocaleString('ko-KR');
}
export function formatWonKorean(v: number | null | undefined): string {
  if (v == null) return '-';
  const won = Math.round(v);
  const man = Math.floor(won / 10000); // 만원 단위
  if (man >= 10000) {
    const eok = Math.floor(man / 10000); const rest = man % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  }
  if (man >= 1) return `${man.toLocaleString('ko-KR')}만원`;
  return `${won.toLocaleString('ko-KR')}원`;
}
export function formatBidRate(v: number | null | undefined): string {
  return v == null ? '-' : `${v}%`;
}
export function formatDiscount(apslAssAmt: number | null | undefined, minBidPrc: number | null | undefined): string {
  if (apslAssAmt == null || minBidPrc == null || apslAssAmt <= 0) return '-';
  const pct = Math.round((minBidPrc / apslAssAmt - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
export function formatAuctionDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
export function statusLabel(s: AuctionStatus | string): string {
  const map: Record<string, string> = { ongoing: '진행중', scheduled: '입찰예정', closed: '마감', sold: '낙찰', failed: '유찰', cancelled: '취소' };
  return map[s] ?? s;
}
export function isAuctionItemIndexable(item: Pick<AuctionItem, 'status'>): boolean {
  return item.status !== 'cancelled';
}
