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

export interface TransactionsParams {
  bjdCode: string;
  dongName: string;
  page: number;
  limit: number;
}

export interface TransactionsResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getTransactions(params: TransactionsParams): Promise<TransactionsResult> {
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

  const items = rows.map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  return {
    items,
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export interface RegionListParams {
  city?: string;
  district?: string;
  /** 지정 시 그 동 하나만. 상세 페이지의 단건 해석 경로 — 아래 getRegionList 주석 참고. */
  dongName?: string;
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
  const { city, district, dongName, page, limit } = params;
  const where = buildRegionFilter(city, district);

  // 동 상세 페이지는 bjdCode 를 얻으려고 이 목록을 `limit: 100` 으로 받아 find 했다.
  // 정렬이 transactionCount desc 라 도달 가능한 건 구·군당 상위 100개뿐이었고,
  // 101위부터는 목록에 없다는 이유로 하드 404 가 됐다. 사이트맵 조건을
  // transactionCount>=3 으로 넓히자 그 구간이 그대로 드러났다 —
  // 실측 2026-09-04(프로덕션): 도달 불가 URL 이 구 조건 0개에서 113개로.
  // 단건 해석에 목록을 쓰지 않으면 창 크기와 무관해진다.
  if (dongName) where.dongName = dongName;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LandTransaction = any;

const JIMOK_GROUP_ORDER = ['대지', '농지', '임야', '잡종지', '도로·기타'];

function jimokGroup(jimok: string | null): string {
  const j = (jimok ?? '').trim();
  if (j === '대') return '대지';
  if (j === '전' || j === '답' || j === '과수원') return '농지';
  if (j === '임야') return '임야';
  if (j === '잡종지') return '잡종지';
  return '도로·기타';
}

export interface RegionDetailResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
  jimokGroups: Array<{ group: string; count: number; avgPricePerPyeong: number | null }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: Array<{ year: number; quarter: number; avgPricePerPyeong: number | null; count: number }>;
  daeCount: number;
  daeNonShareCount: number;
  daeSamples: LandTransaction[];
}

/**
 * 토지 문서를 색인 대상으로 볼 최소 거래 건수.
 *
 * SOURCE OF TRUTH: `frontend/utils/indexability.ts` 의 MIN_INDEXABLE_TRANSACTIONS.
 * backend tsconfig 에서 frontend 를 직접 import 할 수 없어 값을 복제한다
 * (저장소 선례: `backend/src/lib/regionSlugs.ts`). 드리프트는
 * `__tests__/services/landIndexabilityParity.test.ts` 가 소스 대조로 잡는다.
 *
 * 저장 컬럼 `isIndexable`(sync 시점 `recentCount >= 5 || transactionCount >= 10`)을 쓰지
 * 않는 이유: 그 값은 sync 시점 규칙에 묶여 있어 상세 페이지의 판정과 갈라진다. 실제로
 * 갈라졌다 — 실측 2026-09-04 로컬 DB 기준 `index, follow` 로 렌더되면서 사이트맵에는 없는
 * 동(dong)이 53개였다(188 → 241). 사이트맵은 페이지가 실제로 내보내는 신호를 따라야 한다.
 */
const MIN_INDEXABLE_TRANSACTIONS = 3;

export interface HubSummaryResult {
  cities: Array<{ slug: string; city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export async function getHubSummary(): Promise<HubSummaryResult> {
  const rows = await prisma.landAreaSummary.findMany({
    select: { city: true, transactionCount: true },
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
    if (r.transactionCount >= MIN_INDEXABLE_TRANSACTIONS) e.indexableDongCount++;
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
      where: { transactionCount: { gte: MIN_INDEXABLE_TRANSACTIONS } },
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
    select: {
      id: true, jibun: true, jimok: true, landUse: true, dealArea: true, dealAmount: true,
      shareDeal: true, dealType: true, dealYear: true, dealMonth: true, dealDay: true,
    },
    orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
    take: 5000, // 안전 상한: 동 단위 토지 거래량은 이보다 훨씬 적음(미초과 시 전수). unbounded 쿼리로 버퍼풀 점유 방지.
  });

  const items = rows.map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  const jimokGroupMap = new Map<string, { count: number; prices: number[] }>();
  const landUseMap = new Map<string, number>();
  const quarterlyMap = new Map<string, { year: number; quarter: number; prices: number[]; count: number }>();
  let daeCount = 0;
  let daeNonShareCount = 0;
  const daeSampleRows: typeof allRows = [];

  for (const r of allRows) {
    const group = jimokGroup(r.jimok);
    const grpEntry = jimokGroupMap.get(group) ?? { count: 0, prices: [] };
    grpEntry.count++;
    // For '대지' group, only non-share rows count toward avgPricePerPyeong
    const isDaeNonShare = r.jimok?.trim() === '대' && !r.shareDeal;
    if (group !== '대지' || isDaeNonShare) {
      const pppGrp = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
      if (pppGrp !== null) grpEntry.prices.push(pppGrp);
    }
    jimokGroupMap.set(group, grpEntry);

    const lk = r.landUse?.trim() || '기타';
    landUseMap.set(lk, (landUseMap.get(lk) ?? 0) + 1);

    if (r.jimok?.trim() === '대') {
      daeCount++;
      if (!r.shareDeal) {
        daeNonShareCount++;
        daeSampleRows.push(r);
        // quarterly timeline: 비지분 대지만
        const quarter = Math.ceil(r.dealMonth / 3);
        const key = `${r.dealYear}-Q${quarter}`;
        const entry = quarterlyMap.get(key) ?? { year: r.dealYear, quarter, prices: [], count: 0 };
        entry.count++;
        const ppp = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
        if (ppp !== null) entry.prices.push(ppp);
        quarterlyMap.set(key, entry);
      }
    }
  }

  const jimokGroups = JIMOK_GROUP_ORDER
    .filter((g) => jimokGroupMap.has(g))
    .map((g) => {
      const e = jimokGroupMap.get(g)!;
      return {
        group: g,
        count: e.count,
        avgPricePerPyeong: e.prices.length
          ? Math.round((e.prices.reduce((a, b) => a + b, 0) / e.prices.length) * 100) / 100
          : null,
      };
    });

  const landUseDistribution = Array.from(landUseMap.entries())
    .map(([landUse, count]) => ({ landUse, count }))
    .sort((a, b) => b.count - a.count);

  const priceTimeline = Array.from(quarterlyMap.values())
    .map((e) => ({
      year: e.year,
      quarter: e.quarter,
      avgPricePerPyeong: e.prices.length
        ? Math.round((e.prices.reduce((a, b) => a + b, 0) / e.prices.length) * 100) / 100
        : null,
      count: e.count,
    }))
    .sort((a, b) => (a.year - b.year) || (a.quarter - b.quarter));

  // daeSamples: 비지분 대지 최신순 최대 12건 (allRows already desc-ordered)
  const daeSamples = daeSampleRows.slice(0, 12).map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  return {
    items,
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    jimokGroups,
    landUseDistribution,
    priceTimeline,
    daeCount,
    daeNonShareCount,
    daeSamples,
  };
}
