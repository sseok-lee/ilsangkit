// backend/src/services/auctionService.ts
import { prisma } from '../lib/prisma.js';
// ⚠️ buildRegionFilter는 src/services/cityMapping.ts에 있음 (landService.ts:2와 동일 — '../lib/' 아님!)
import { buildRegionFilter } from './cityMapping.js';

const PYEONG_PER_SQM = 3.305;

/**
 * 시세 비교 데이터. 현재 land(평당)만 지원:
 *
 * land:
 *   marketAvg = 원/평 (LandAreaSummary.avgPricePerPyeong [만원/평] × 10000)
 *   apslAssAmtForCompare = 물건의 평당 감정가(원/평) = apslAssAmt(원) ÷ (landArea㎡ ÷ 3.305)
 *   → AuctionPriceCompare에 apslAssAmt 대신 apslAssAmtForCompare를 넘겨 단위 일치시킴
 *   → landArea가 없으면 null
 *
 * 주거/기타: 감정가(물건 전체, 다세대·일괄 포함) vs 단일세대 평균이라 단위 비교 부정확 → null
 *   (후속: 세대당 정규화 필요)
 */
export interface MarketCompare {
  marketAvg: number;
  label: string;
  /** land 전용: 물건의 평당 감정가(원/평). 미설정이면 apslAssAmt 원본 사용. */
  apslAssAmtForCompare?: number;
}

async function computeMarketCompare(
  item: {
    bjdCode: string;
    dongName: string | null;
    usageGroup: string;
    landArea: { toNumber?: () => number } | number | null;
    apslAssAmt: bigint | number | null;
  },
): Promise<MarketCompare | null> {
  try {
    if (item.usageGroup === 'land') {
      // landArea 필수: 없으면 평당 감정가 산출 불가
      const landAreaVal = item.landArea == null ? null
        : typeof item.landArea === 'object' && typeof (item.landArea as any).toNumber === 'function'
          ? (item.landArea as any).toNumber()
          : Number(item.landArea);
      if (!landAreaVal || landAreaVal <= 0) return null;

      // LandAreaSummary: bjdCode(5-digit 시군구) + dongName으로 조회. dongName 없으면 최다거래 동 fallback.
      let summary: { avgPricePerPyeong: any; dongName: string; district: string } | null = null;
      if (item.dongName) {
        summary = await prisma.landAreaSummary.findUnique({
          where: { bjdCode_dongName: { bjdCode: item.bjdCode, dongName: item.dongName } },
          select: { avgPricePerPyeong: true, dongName: true, district: true },
        });
      }
      if (!summary) {
        summary = await prisma.landAreaSummary.findFirst({
          where: { bjdCode: item.bjdCode },
          orderBy: { transactionCount: 'desc' },
          select: { avgPricePerPyeong: true, dongName: true, district: true },
        }) as typeof summary;
      }
      if (!summary?.avgPricePerPyeong) return null;

      // avgPricePerPyeong: 만원/평 → 원/평으로 변환
      const avgPPP = typeof (summary.avgPricePerPyeong as any).toNumber === 'function'
        ? (summary.avgPricePerPyeong as any).toNumber()
        : Number(summary.avgPricePerPyeong);
      if (!avgPPP || avgPPP <= 0) return null;

      const apslAssAmtVal = item.apslAssAmt == null ? null
        : typeof item.apslAssAmt === 'bigint' ? Number(item.apslAssAmt) : Number(item.apslAssAmt);
      const pyeong = landAreaVal / PYEONG_PER_SQM;
      const apslPerPyeong = apslAssAmtVal != null && pyeong > 0
        ? Math.round(apslAssAmtVal / pyeong)
        : undefined;

      const locationLabel = item.dongName ?? summary.district ?? '';
      return {
        marketAvg: Math.round(avgPPP * 10000),   // 원/평
        label: `${locationLabel} 토지 평균(평당)`,
        ...(apslPerPyeong != null ? { apslAssAmtForCompare: apslPerPyeong } : {}),
      };
    }

    // 주거/기타는 감정가(물건 전체, 다세대·일괄 포함) vs 단일세대 평균이라 단위 비교 부정확
    // → 후속(세대당 정규화 필요). 현재 land(평당)만 지원
    return null;
  } catch {
    return null;
  }
}

function serializeRow<T extends Record<string, any>>(row: T): any {
  const out: Record<string, any> = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'bigint') out[k] = Number(v);
    else if (v && typeof v === 'object' && typeof v.toNumber === 'function') out[k] = v.toNumber();
    else if (v instanceof Date) out[k] = v.toISOString();
  }
  return out;
}

export interface ItemsParams {
  city?: string; district?: string; usage?: string; status?: string;
  sort?: 'deadline' | 'apsl' | 'bidRate'; page: number; limit: number;
}
export async function getItems(p: ItemsParams) {
  const where: Record<string, any> = { ...buildRegionFilter(p.city, p.district) };
  if (p.usage) where.usageGroup = p.usage;
  if (p.status === 'ongoing') where.status = { in: ['ongoing', 'scheduled'] };
  else if (p.status === 'closed') where.isClosed = true;
  const orderBy = p.sort === 'apsl' ? { apslAssAmt: 'desc' as const }
    : p.sort === 'bidRate' ? { bidRate: 'desc' as const }
    : { bidCloseDtm: 'asc' as const };
  const [total, rows] = await Promise.all([
    prisma.auctionItem.count({ where }),
    prisma.auctionItem.findMany({ where, orderBy, skip: (p.page - 1) * p.limit, take: p.limit }),
  ]);
  return { items: rows.map(serializeRow), total, page: p.page, totalPages: Math.ceil(total / p.limit) };
}

export async function getItemDetail(cltrMngNo: string) {
  const item = await prisma.auctionItem.findUnique({ where: { cltrMngNo } });
  if (!item) return null;
  const [nearby, marketCompare] = await Promise.all([
    prisma.auctionItem.findMany({
      where: { bjdCode: item.bjdCode, usageGroup: item.usageGroup, cltrMngNo: { not: cltrMngNo }, isClosed: false },
      orderBy: { bidCloseDtm: 'asc' }, take: 6,
    }),
    computeMarketCompare(item),
  ]);
  return { item: serializeRow(item), nearby: nearby.map(serializeRow), marketCompare };
}

export interface RegionDetailParams { bjdCode: string; }
export async function getRegionDetail(p: RegionDetailParams) {
  const summaries = await prisma.auctionAreaSummary.findMany({ where: { bjdCode: p.bjdCode } });
  const active = await prisma.auctionItem.findMany({
    where: { bjdCode: p.bjdCode, isClosed: false }, orderBy: { bidCloseDtm: 'asc' }, take: 20,
  });
  const recentSold = await prisma.auctionItem.findMany({
    where: { bjdCode: p.bjdCode, resultType: 'sold' }, orderBy: { resultDate: 'desc' }, take: 10,
  });
  return {
    usageGroups: summaries.map(serializeRow),
    activeItems: active.map(serializeRow),
    recentSold: recentSold.map(serializeRow),
  };
}

export async function getCityDetail(city: string) {
  const where = buildRegionFilter(city);
  const summaries = await prisma.auctionAreaSummary.findMany({ where });
  // 시군구별 합산
  const byDistrict = new Map<string, any>();
  for (const s of summaries) {
    const cur = byDistrict.get(s.district) ?? { district: s.district, bjdCode: s.bjdCode, activeCount: 0, soldCount: 0, isIndexable: false };
    cur.activeCount += s.activeCount; cur.soldCount += s.soldCount; cur.isIndexable ||= s.isIndexable;
    byDistrict.set(s.district, cur);
  }
  return { districts: [...byDistrict.values()] };
}

// /regions: 시군구 단위 집계 목록(용도 합산). 허브 지역 리스트 + 시군구 페이지 bjdCode 해석에 사용.
export interface RegionListParams { city?: string; onlyIndexable?: boolean; }
export async function getRegionList(p: RegionListParams) {
  const where: Record<string, any> = { ...buildRegionFilter(p.city) };
  if (p.onlyIndexable) where.isIndexable = true;
  const summaries = await prisma.auctionAreaSummary.findMany({ where });
  const byDistrict = new Map<string, any>();
  for (const s of summaries) {
    const key = `${s.city}|${s.district}`;
    const cur = byDistrict.get(key) ?? { city: s.city, district: s.district, bjdCode: s.bjdCode, activeCount: 0, closedCount: 0, soldCount: 0, isIndexable: false };
    cur.activeCount += s.activeCount; cur.closedCount += s.closedCount; cur.soldCount += s.soldCount;
    cur.isIndexable ||= s.isIndexable;
    byDistrict.set(key, cur);
  }
  return { items: [...byDistrict.values()] };
}

export async function getHubSummary() {
  const summaries = await prisma.auctionAreaSummary.findMany();
  const totalActive = summaries.reduce((a, s) => a + s.activeCount, 0);
  const totalSold = summaries.reduce((a, s) => a + s.soldCount, 0);
  return { totalActive, totalSold, regionCount: new Set(summaries.map((s) => s.bjdCode)).size };
}

export interface RankingParams { usage?: string; order: 'high' | 'low' | 'count'; limit: number; }
export async function getRanking(p: RankingParams) {
  const where: Record<string, any> = { isIndexable: true, soldCount: { gte: 3 }, avgBidRate: { not: null } };
  if (p.usage) where.usageGroup = p.usage;
  const orderBy = p.order === 'count' ? { soldCount: 'desc' as const } : { avgBidRate: p.order === 'high' ? 'desc' as const : 'asc' as const };
  const rows = await prisma.auctionAreaSummary.findMany({
    where, orderBy, take: p.limit,
  });
  return rows.map(serializeRow);
}

export async function getSitemapEntries() {
  const indexable = await prisma.auctionAreaSummary.findMany({
    where: { isIndexable: true }, select: { city: true, district: true, bjdCode: true, usageGroup: true },
  });
  const items = await prisma.auctionItem.findMany({
    where: { status: { in: ['ongoing', 'scheduled', 'sold', 'failed'] } }, select: { cltrMngNo: true }, take: 50000,
  });
  return { regions: indexable, items: items.map((i) => i.cltrMngNo) };
}
