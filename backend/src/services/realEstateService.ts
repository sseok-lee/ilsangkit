import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type RealEstateType =
  | 'apt-sale'
  | 'apt-rent'
  | 'villa-sale'
  | 'villa-rent'
  | 'offitel-sale'
  | 'offitel-rent';

const SALE_TYPES: RealEstateType[] = ['apt-sale', 'villa-sale', 'offitel-sale'];

export interface SearchTransactionParams {
  city?: string;
  district?: string;
  bjdCode?: string;
  buildingName?: string;
  dealYear?: number;
  dealMonth?: number;
  page: number;
  limit: number;
}

export interface TransactionResult {
  items: unknown[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MonthlyStats {
  year: number;
  month: number;
  avgPrice: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  count: number;
}

export interface ComplexItem {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  transactionCount: number;
  latestPrice: number | null;
  lat: number | null;
  lng: number | null;
  lastDealYear: number | null;
  lastDealMonth: number | null;
}

export interface SearchAllResult {
  categories: Array<{
    type: RealEstateType;
    count: number;
    items: unknown[];
  }>;
}

// ─────────────────────────────────────────────
// Model registry
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModel(type: string): any {
  switch (type) {
    case 'apt-sale':
      return prisma.aptSaleTransaction;
    case 'apt-rent':
      return prisma.aptRentTransaction;
    case 'villa-sale':
      return prisma.villaSaleTransaction;
    case 'villa-rent':
      return prisma.villaRentTransaction;
    case 'offitel-sale':
      return prisma.offitelSaleTransaction;
    case 'offitel-rent':
      return prisma.offitelRentTransaction;
    default:
      throw new Error(`Unknown real estate type: ${type}`);
  }
}

function isSaleType(type: string): boolean {
  return SALE_TYPES.includes(type as RealEstateType);
}

export const TABLE_NAME_MAP: Record<string, string> = {
  'apt-sale': 'AptSaleTransaction',
  'apt-rent': 'AptRentTransaction',
  'villa-sale': 'VillaSaleTransaction',
  'villa-rent': 'VillaRentTransaction',
  'offitel-sale': 'OffitelSaleTransaction',
  'offitel-rent': 'OffitelRentTransaction',
};

export function getTableName(type: string): string {
  const name = TABLE_NAME_MAP[type];
  if (!name) throw new Error(`Unknown real estate type: ${type}`);
  return name;
}

/**
 * BigInt/Decimal → Number 변환 (JSON 직렬화 호환)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow(row: any): any {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'bigint') {
      result[key] = Number(result[key]);
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// searchTransactions
// ─────────────────────────────────────────────

/**
 * 거래 검색 + 페이지네이션
 */
export async function searchTransactions(
  type: string,
  params: SearchTransactionParams
): Promise<TransactionResult> {
  const model = getModel(type);
  const { city, district, bjdCode, buildingName, dealYear, dealMonth, page, limit } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (city) where.city = city;
  if (district) where.district = district;
  if (bjdCode) where.bjdCode = bjdCode;
  if (buildingName) where.buildingName = { startsWith: buildingName };
  if (dealYear !== undefined) where.dealYear = dealYear;
  if (dealMonth !== undefined) where.dealMonth = dealMonth;

  const skip = (page - 1) * limit;

  const select = isSaleType(type)
    ? {
        id: true, buildingName: true, bjdCode: true, city: true, district: true, dongName: true,
        floor: true, exclusiveArea: true, buildYear: true,
        dealYear: true, dealMonth: true, dealDay: true,
        dealAmount: true, dealType: true, buyerType: true, sellerType: true,
        cancelDealDay: true,
      }
    : {
        id: true, buildingName: true, bjdCode: true, city: true, district: true, dongName: true,
        floor: true, exclusiveArea: true, buildYear: true,
        dealYear: true, dealMonth: true, dealDay: true,
        deposit: true, monthlyRent: true, rentType: true,
        contractType: true, contractTerm: true,
        preDeposit: true, preMonthlyRent: true,
      };

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      select,
      skip,
      take: limit,
      orderBy: [
        { dealYear: 'desc' },
        { dealMonth: 'desc' },
        { dealDay: 'desc' },
      ],
    }),
    model.count({ where }),
  ]);

  return {
    items: items.map(serializeRow),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────
// getTransactionStats
// ─────────────────────────────────────────────

/**
 * 시세 시계열 - 최근 N개월 월별 통계
 */
export async function getTransactionStats(
  type: string,
  bjdCode: string,
  buildingName: string | undefined,
  months: number
): Promise<MonthlyStats[]> {
  const model = getModel(type);
  const priceField = isSaleType(type) ? 'dealAmount' : 'deposit';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { bjdCode };
  if (buildingName) where.buildingName = buildingName;

  // Limit to recent N months
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  where.OR = [
    { dealYear: { gt: cutoff.getFullYear() } },
    {
      dealYear: cutoff.getFullYear(),
      dealMonth: { gte: cutoff.getMonth() + 1 },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupByResult: any[] = await model.groupBy({
    by: ['dealYear', 'dealMonth'],
    where,
    _avg: { [priceField]: true },
    _max: { [priceField]: true },
    _min: { [priceField]: true },
    _count: { [priceField]: true },
    orderBy: [{ dealYear: 'asc' }, { dealMonth: 'asc' }],
  });

  return groupByResult.map((row) => ({
    year: row.dealYear,
    month: row.dealMonth,
    avgPrice: row._avg[priceField] !== null ? Number(row._avg[priceField]) : null,
    maxPrice: row._max[priceField] !== null ? Number(row._max[priceField]) : null,
    minPrice: row._min[priceField] !== null ? Number(row._min[priceField]) : null,
    count: row._count[priceField],
  }));
}

// ─────────────────────────────────────────────
// getComplexList
// ─────────────────────────────────────────────

export interface ComplexListResult {
  items: ComplexItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * 건물 목록 조회 — RealEstateBuildingSummary 테이블 (GROUP BY 제거)
 */
export async function getComplexList(
  type: string,
  city?: string,
  district?: string,
  buildingName?: string,
  page: number = 1,
  limit: number = 15
): Promise<ComplexListResult> {
  if (!TABLE_NAME_MAP[type]) throw new Error(`Unknown real estate type: ${type}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { type };
  if (city) where.city = city;
  if (district) where.district = district;
  if (buildingName) where.buildingName = { startsWith: buildingName };

  const [items, total] = await Promise.all([
    prisma.realEstateBuildingSummary.findMany({
      where,
      orderBy: { transactionCount: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.realEstateBuildingSummary.count({ where }),
  ]);

  return {
    items: items.map((row) => ({
      buildingName: row.buildingName,
      bjdCode: row.bjdCode,
      city: row.city,
      district: row.district,
      dongName: row.dongName,
      transactionCount: row.transactionCount,
      latestPrice: row.latestPrice != null ? Number(row.latestPrice) : null,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      lastDealYear: row.latestDealYear,
      lastDealMonth: row.latestDealMonth,
    })),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────
// getBuildingInfo
// ─────────────────────────────────────────────

export interface BuildingInfo {
  buildingName: string;
  city: string;
  district: string;
  dongName: string;
  roadName: string | null;
  jibun: string | null;
  buildYear: number | null;
  minArea: number | null;
  maxArea: number | null;
  latestDealAmount: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  lat: number | null;
  lng: number | null;
}

/**
 * 건물 정보 집계 - 최신 거래 1건 + 면적 min/max
 */
export async function getBuildingInfo(
  type: string,
  bjdCode: string,
  buildingName: string
): Promise<BuildingInfo | null> {
  const model = getModel(type);
  const where = { bjdCode, buildingName };
  const priceField = isSaleType(type) ? 'dealAmount' : 'deposit';

  const [latest, agg] = await Promise.all([
    model.findFirst({
      where,
      orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
    }),
    model.aggregate({
      where,
      _min: { exclusiveArea: true },
      _max: { exclusiveArea: true },
    }),
  ]);

  if (!latest) return null;

  return {
    buildingName: latest.buildingName,
    city: latest.city,
    district: latest.district,
    dongName: latest.dongName,
    roadName: latest.roadName ?? null,
    jibun: latest.jibun ?? null,
    buildYear: latest.buildYear ?? null,
    minArea: agg._min.exclusiveArea !== null ? Number(agg._min.exclusiveArea) : null,
    maxArea: agg._max.exclusiveArea !== null ? Number(agg._max.exclusiveArea) : null,
    latestDealAmount: latest[priceField] !== null ? Number(latest[priceField]) : null,
    latestDealYear: latest.dealYear,
    latestDealMonth: latest.dealMonth,
    lat: latest.lat !== null ? Number(latest.lat) : null,
    lng: latest.lng !== null ? Number(latest.lng) : null,
  };
}

// ─────────────────────────────────────────────
// searchAll
// ─────────────────────────────────────────────

const ALL_TYPES: RealEstateType[] = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
];

/**
 * 통합 검색 - 6개 테이블 buildingName LIKE 검색 (병렬)
 */
export async function searchAll(
  keyword?: string,
  city?: string,
  district?: string
): Promise<SearchAllResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (keyword) where.buildingName = { startsWith: keyword };
  if (city) where.city = city;
  if (district) where.district = district;

  const results = await Promise.all(
    ALL_TYPES.map(async (type) => {
      const model = getModel(type);
      const [items, count] = await Promise.all([
        model.findMany({ where, take: 3 }),
        model.count({ where }),
      ]);
      return { type, count, items: items.map(serializeRow) };
    })
  );

  return { categories: results };
}
