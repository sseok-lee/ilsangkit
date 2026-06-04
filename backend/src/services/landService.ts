import { prisma } from '../lib/prisma.js';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (city) where.city = city;
  if (district) where.district = district;

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
  jimokDistribution: Array<{ jimok: string; count: number }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: Array<{ year: number; month: number; avgPricePerPyeong: number | null; count: number }>;
}

export interface HubSummaryResult {
  cities: Array<{ city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export async function getHubSummary(): Promise<HubSummaryResult> {
  const rows = await prisma.landAreaSummary.findMany({
    select: { city: true, transactionCount: true, isIndexable: true },
  });

  const cityMap = new Map<string, { indexableDongCount: number; totalTransactions: number }>();
  let totalTransactions = 0;
  for (const r of rows) {
    const e = cityMap.get(r.city) ?? { indexableDongCount: 0, totalTransactions: 0 };
    if (r.isIndexable) e.indexableDongCount++;
    e.totalTransactions += r.transactionCount;
    totalTransactions += r.transactionCount;
    cityMap.set(r.city, e);
  }

  const cities = Array.from(cityMap.entries())
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.totalTransactions - a.totalTransactions);

  return { cities, totalTransactions };
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
  });

  const items = rows.map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  const jimokMap = new Map<string, number>();
  const landUseMap = new Map<string, number>();
  const timelineMap = new Map<string, { year: number; month: number; prices: number[]; count: number }>();

  for (const r of allRows) {
    const jk = r.jimok?.trim() || '기타';
    jimokMap.set(jk, (jimokMap.get(jk) ?? 0) + 1);
    const lk = r.landUse?.trim() || '기타';
    landUseMap.set(lk, (landUseMap.get(lk) ?? 0) + 1);

    const key = `${r.dealYear}-${r.dealMonth}`;
    const entry = timelineMap.get(key) ?? { year: r.dealYear, month: r.dealMonth, prices: [], count: 0 };
    entry.count++;
    const ppp = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    if (ppp !== null) entry.prices.push(ppp);
    timelineMap.set(key, entry);
  }

  const jimokDistribution = Array.from(jimokMap.entries())
    .map(([jimok, count]) => ({ jimok, count }))
    .sort((a, b) => b.count - a.count);
  const landUseDistribution = Array.from(landUseMap.entries())
    .map(([landUse, count]) => ({ landUse, count }))
    .sort((a, b) => b.count - a.count);
  const priceTimeline = Array.from(timelineMap.values())
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
  };
}
