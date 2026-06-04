import { prisma } from '../lib/prisma.js';
import { buildRegionFilter, SHORT_TO_SLUG, FULL_TO_SLUG, CITY_SLUG_TO_FULL } from './cityMapping.js';

const PYEONG_PER_SQM = 3.305;

function pricePerPyeong(dealAmount: number, dealArea: number | null): number | null {
  if (!dealArea || dealArea <= 0) return null;
  return Math.round((dealAmount / (dealArea / PYEONG_PER_SQM)) * 100) / 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow(row: any): any {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const v = result[key];
    if (typeof v === 'bigint') result[key] = Number(v);
    else if (v && typeof v === 'object' && typeof v.toNumber === 'function') result[key] = v.toNumber();
  }
  return result;
}

export interface RegionListParams {
  city?: string;
  district?: string;
  page: number;
  limit: number;
}

export interface RegionListResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getRegionList(params: RegionListParams): Promise<RegionListResult> {
  const { city, district, page, limit } = params;
  const where = buildRegionFilter(city, district);

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.landAreaSummary.findMany({
      where,
      orderBy: { transactionCount: 'desc' },
      skip,
      take: limit,
    }),
    prisma.landAreaSummary.count({ where }),
  ]);

  return {
    items: rows.map((r) => {
      const s = serializeRow(r);
      if (s.avgPricePerPyeong != null) s.avgPricePerPyeong = Number(s.avgPricePerPyeong);
      return s;
    }),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export interface RegionDetailParams {
  bjdCode: string;
  dongName: string;
  months?: number;
  page: number;
  limit: number;
}

export interface RegionDetailResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
  jimokDistribution: Array<{ jimok: string; count: number; avgPricePerPyeong: number | null }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: Array<{ year: number; month: number; avgPricePerPyeong: number | null; count: number }>;
  daeCount: number;
}

export interface HubSummaryResult {
  cities: Array<{ slug: string; city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export async function getHubSummary(): Promise<HubSummaryResult> {
  const rows = await prisma.landAreaSummary.findMany({
    select: { city: true, transactionCount: true, isIndexable: true },
  });

  const slugMap = new Map<string, { city: string; indexableDongCount: number; totalTransactions: number }>();
  let totalTransactions = 0;
  for (const r of rows) {
    const slug = SHORT_TO_SLUG[r.city] || FULL_TO_SLUG[r.city] || r.city;
    const e = slugMap.get(slug) ?? {
      city: CITY_SLUG_TO_FULL[slug] || r.city,
      indexableDongCount: 0,
      totalTransactions: 0,
    };
    if (r.isIndexable) e.indexableDongCount++;
    e.totalTransactions += r.transactionCount;
    totalTransactions += r.transactionCount;
    slugMap.set(slug, e);
  }

  const cities = Array.from(slugMap.entries())
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.totalTransactions - a.totalTransactions);

  return { cities, totalTransactions };
}

export interface LandSitemapEntries {
  cities: Array<{ city: string; district: string }>;
  indexableDongs: Array<{ city: string; district: string; dongName: string }>;
}

export async function getSitemapEntries(): Promise<LandSitemapEntries> {
  const [cities, indexableDongs] = await Promise.all([
    prisma.landAreaSummary.findMany({
      distinct: ['city', 'district'],
      select: { city: true, district: true },
    }),
    prisma.landAreaSummary.findMany({
      where: { isIndexable: true },
      select: { city: true, district: true, dongName: true },
    }),
  ]);
  return { cities, indexableDongs };
}

export async function getRegionDetail(params: RegionDetailParams): Promise<RegionDetailResult> {
  const { bjdCode, dongName, page, limit } = params;
  const where = { bjdCode, dongName, cancelDealDay: null };
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.landSaleTransaction.findMany({
      where,
      select: {
        id: true, jibun: true, jimok: true, landUse: true, dealArea: true, shareDeal: true,
        dealAmount: true, dealType: true, dealYear: true, dealMonth: true, dealDay: true,
      },
      orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.landSaleTransaction.count({ where }),
  ]);

  const allRows = await prisma.landSaleTransaction.findMany({
    where,
    select: { jimok: true, landUse: true, dealArea: true, dealAmount: true, dealYear: true, dealMonth: true },
    orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
    take: 5000, // 안전 상한: 동 단위 토지 거래량은 이보다 훨씬 적음(미초과 시 전수). unbounded 쿼리로 버퍼풀 점유 방지.
  });

  const items = rows.map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  const jimokMap = new Map<string, { count: number; prices: number[] }>();
  const landUseMap = new Map<string, number>();
  const daeTimelineMap = new Map<string, { year: number; month: number; prices: number[]; count: number }>();
  let daeCount = 0;

  for (const r of allRows) {
    const jk = r.jimok?.trim() || '기타';
    const jkEntry = jimokMap.get(jk) ?? { count: 0, prices: [] };
    jkEntry.count++;
    const pppJk = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    if (pppJk !== null) jkEntry.prices.push(pppJk);
    jimokMap.set(jk, jkEntry);

    const lk = r.landUse?.trim() || '기타';
    landUseMap.set(lk, (landUseMap.get(lk) ?? 0) + 1);

    // priceTimeline and daeCount: 대지(jimok=대) only
    if (r.jimok?.trim() === '대') {
      daeCount++;
      const key = `${r.dealYear}-${r.dealMonth}`;
      const entry = daeTimelineMap.get(key) ?? { year: r.dealYear, month: r.dealMonth, prices: [], count: 0 };
      entry.count++;
      const ppp = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
      if (ppp !== null) entry.prices.push(ppp);
      daeTimelineMap.set(key, entry);
    }
  }

  const jimokDistribution = Array.from(jimokMap.entries())
    .map(([jimok, e]) => ({
      jimok,
      count: e.count,
      avgPricePerPyeong: e.prices.length
        ? Math.round((e.prices.reduce((a, b) => a + b, 0) / e.prices.length) * 100) / 100
        : null,
    }))
    .sort((a, b) => b.count - a.count);
  const landUseDistribution = Array.from(landUseMap.entries())
    .map(([landUse, count]) => ({ landUse, count }))
    .sort((a, b) => b.count - a.count);
  const priceTimeline = Array.from(daeTimelineMap.values())
    .map((e) => ({
      year: e.year,
      month: e.month,
      avgPricePerPyeong: e.prices.length ? Math.round((e.prices.reduce((a, b) => a + b, 0) / e.prices.length) * 100) / 100 : null,
      count: e.count,
    }))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));

  return {
    items,
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    jimokDistribution,
    landUseDistribution,
    priceTimeline,
    daeCount,
  };
}
