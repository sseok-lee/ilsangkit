// backend/src/services/auctionService.ts
import { prisma } from '../lib/prisma.js';
// ⚠️ buildRegionFilter는 src/services/cityMapping.ts에 있음 (landService.ts:2와 동일 — '../lib/' 아님!)
import { buildRegionFilter } from './cityMapping.js';

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
  const nearby = await prisma.auctionItem.findMany({
    where: { bjdCode: item.bjdCode, usageGroup: item.usageGroup, cltrMngNo: { not: cltrMngNo }, isClosed: false },
    orderBy: { bidCloseDtm: 'asc' }, take: 6,
  });
  return { item: serializeRow(item), nearby: nearby.map(serializeRow) };
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

export interface RankingParams { usage?: string; order: 'high' | 'low'; limit: number; }
export async function getRanking(p: RankingParams) {
  const where: Record<string, any> = { isIndexable: true, soldCount: { gte: 3 }, avgBidRate: { not: null } };
  if (p.usage) where.usageGroup = p.usage;
  const rows = await prisma.auctionAreaSummary.findMany({
    where, orderBy: { avgBidRate: p.order === 'high' ? 'desc' : 'asc' }, take: p.limit,
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
