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
  | 'offitel-rent'
  | 'store-sale'
  | 'land-sale';

const SALE_TYPES: RealEstateType[] = ['apt-sale', 'villa-sale', 'offitel-sale', 'store-sale', 'land-sale'];

export interface SearchTransactionParams {
  city?: string;
  district?: string;
  bjdCode?: string;
  buildingName?: string;
  dealYear?: number;
  dealMonth?: number;
  exclusiveArea?: number;
  rentType?: string;
  months?: number;
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

export interface StatsSummary {
  recentAvg: number | null;
  previousAvg: number | null;
  changeRate: number | null;
  totalCount: number;
  lowVolume: boolean;
  priceLabel: string;
}

export interface StatsResponse {
  monthly: MonthlyStats[];
  summary: StatsSummary;
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
  buildYear: number | null;
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
    case 'store-sale':
      return prisma.storeSaleTransaction;
    case 'land-sale':
      return prisma.landSaleTransaction;
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
  'store-sale': 'StoreSaleTransaction',
  'land-sale': 'LandSaleTransaction',
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
  const { city, district, bjdCode, buildingName, dealYear, dealMonth, page, limit, exclusiveArea, rentType, months } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (city) where.city = city;
  if (district) where.district = district;
  if (bjdCode) where.bjdCode = bjdCode;
  if (buildingName) where.buildingName = { startsWith: buildingName };
  if (dealYear !== undefined) where.dealYear = dealYear;
  if (dealMonth !== undefined) where.dealMonth = dealMonth;
  if (exclusiveArea) where.exclusiveArea = { gte: exclusiveArea - 2, lte: exclusiveArea + 2 };
  if (rentType) where.rentType = rentType;
  if (isSaleType(type)) where.cancelDealDay = null;

  // 기간 필터: months 전달 시 최근 N개월로 제한
  if (months) {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    where.OR = [
      { dealYear: { gt: cutoff.getFullYear() } },
      {
        dealYear: cutoff.getFullYear(),
        dealMonth: { gte: cutoff.getMonth() + 1 },
      },
    ];
  }

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
 * 시세 시계열 - 최근 N개월 월별 통계 + 3개월 이동평균 summary
 */
export async function getTransactionStats(
  type: string,
  bjdCode: string,
  buildingName: string | undefined,
  months?: number,
  exclusiveArea?: number,
  rentType?: string
): Promise<StatsResponse> {
  const model = getModel(type);
  const tableName = getTableName(type);
  const isSale = isSaleType(type);

  // 환산보증금 상수: 전환율 5% 기준 (12 / 0.05 = 240개월)
  const CONVERSION_MONTHS = 240;

  // 월세 또는 전체(rent) 중 월세 포함 시 → raw query로 환산보증금 계산
  const needsConvertedDeposit = !isSale && (rentType === '월세' || !rentType);

  // where 조건 구성
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { bjdCode };
  if (buildingName) where.buildingName = buildingName;
  if (exclusiveArea) where.exclusiveArea = { gte: exclusiveArea - 2, lte: exclusiveArea + 2 };
  if (rentType) where.rentType = rentType;
  if (isSale) where.cancelDealDay = null;

  // Limit to recent N months (months 미지정 시 전체 기간)
  let cutoff: Date | null = null;
  if (months) {
    const now = new Date();
    cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    where.OR = [
      { dealYear: { gt: cutoff.getFullYear() } },
      {
        dealYear: cutoff.getFullYear(),
        dealMonth: { gte: cutoff.getMonth() + 1 },
      },
    ];
  }

  let monthly: MonthlyStats[];

  if (needsConvertedDeposit) {
    // 월세 포함 시: raw query로 환산보증금 계산
    // 전세: deposit 그대로, 월세: deposit + monthlyRent * 240
    const whereClauses: string[] = [`bjdCode = ?`];
    const params: (string | number)[] = [bjdCode];

    if (buildingName) { whereClauses.push(`buildingName = ?`); params.push(buildingName); }
    if (exclusiveArea) {
      whereClauses.push(`exclusiveArea >= ? AND exclusiveArea <= ?`);
      params.push(exclusiveArea - 2, exclusiveArea + 2);
    }
    if (rentType) { whereClauses.push(`rentType = ?`); params.push(rentType); }
    if (cutoff) {
      whereClauses.push(`(dealYear > ? OR (dealYear = ? AND dealMonth >= ?))`);
      params.push(cutoff.getFullYear(), cutoff.getFullYear(), cutoff.getMonth() + 1);
    }

    const priceExpr = rentType === '월세'
      ? `deposit + monthlyRent * ${CONVERSION_MONTHS}`
      : `CASE WHEN rentType = '월세' THEN deposit + monthlyRent * ${CONVERSION_MONTHS} ELSE deposit END`;

    const sql = `
      SELECT dealYear, dealMonth,
        AVG(${priceExpr}) as avgPrice,
        MAX(${priceExpr}) as maxPrice,
        MIN(${priceExpr}) as minPrice,
        COUNT(*) as count
      FROM ${tableName}
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY dealYear, dealMonth
      ORDER BY dealYear ASC, dealMonth ASC
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResult: any[] = await prisma.$queryRawUnsafe(sql, ...params);
    monthly = rawResult.map((row) => ({
      year: Number(row.dealYear),
      month: Number(row.dealMonth),
      avgPrice: row.avgPrice !== null ? Number(row.avgPrice) : null,
      maxPrice: row.maxPrice !== null ? Number(row.maxPrice) : null,
      minPrice: row.minPrice !== null ? Number(row.minPrice) : null,
      count: Number(row.count),
    }));
  } else {
    // 매매 또는 전세 전용: Prisma groupBy 사용
    const priceField = isSale ? 'dealAmount' : 'deposit';

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

    monthly = groupByResult.map((row) => ({
      year: row.dealYear,
      month: row.dealMonth,
      avgPrice: row._avg[priceField] !== null ? Number(row._avg[priceField]) : null,
      maxPrice: row._max[priceField] !== null ? Number(row._max[priceField]) : null,
      minPrice: row._min[priceField] !== null ? Number(row._min[priceField]) : null,
      count: row._count[priceField],
    }));
  }

  // 3개월 이동평균 summary 계산
  const sorted = [...monthly].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
  const recent3 = sorted.slice(-3);
  const previous3 = sorted.slice(-6, -3);

  const calcAvg = (rows: MonthlyStats[]): number | null => {
    const valid = rows.filter((r) => r.avgPrice !== null);
    if (valid.length === 0) return null;
    return valid.reduce((sum, r) => sum + r.avgPrice!, 0) / valid.length;
  };

  const recentAvg = calcAvg(recent3);
  const previousAvg = calcAvg(previous3);
  const changeRate =
    recentAvg !== null && previousAvg !== null && previousAvg !== 0
      ? ((recentAvg - previousAvg) / previousAvg) * 100
      : null;

  const recentCount = recent3.reduce((sum, r) => sum + r.count, 0);
  const totalCount = monthly.reduce((sum, r) => sum + r.count, 0);

  // 가격 지표명 결정
  let priceLabel = '매매가';
  if (!isSale) {
    if (rentType === '전세') priceLabel = '보증금';
    else if (rentType === '월세') priceLabel = '환산보증금';
    else priceLabel = '환산보증금'; // 전체: 전세+환산월세 통합
  }

  return {
    monthly,
    summary: {
      recentAvg,
      previousAvg,
      changeRate,
      totalCount,
      lowVolume: recentCount < 3,
      priceLabel,
    },
  };
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
      buildYear: row.buildYear,
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
// getAreaGroups
// ─────────────────────────────────────────────

export interface AreaGroup {
  area: number;
  pyeong: number;
  count: number;
}

/**
 * 전용면적 그룹 목록 - ±2㎡ 이내 병합, count 내림차순
 */
export async function getAreaGroups(
  type: string,
  bjdCode: string,
  buildingName?: string
): Promise<AreaGroup[]> {
  const model = getModel(type);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { bjdCode };
  if (buildingName) where.buildingName = buildingName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupByResult: any[] = await model.groupBy({
    by: ['exclusiveArea'],
    where,
    _count: { exclusiveArea: true },
  });

  // Math.round 반올림 후 ±2㎡ 그룹 병합
  const raw = groupByResult.map((row) => ({
    area: Math.round(Number(row.exclusiveArea)),
    count: row._count.exclusiveArea as number,
  }));

  const merged: { area: number; count: number }[] = [];
  for (const item of raw) {
    const existing = merged.find((g) => Math.abs(g.area - item.area) <= 2);
    if (existing) {
      existing.count += item.count;
    } else {
      merged.push({ area: item.area, count: item.count });
    }
  }

  return merged
    .sort((a, b) => a.area - b.area)
    .map((g) => ({
      area: g.area,
      pyeong: Math.round(g.area / 3.305),
      count: g.count,
    }));
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
  'store-sale',
  'land-sale',
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

  const searchAllSelect = {
    id: true,
    buildingName: true,
    city: true,
    district: true,
    bjdCode: true,
    dealYear: true,
    dealMonth: true,
    dealDay: true,
    exclusiveArea: true,
    floor: true,
    dealAmount: true,
  };

  const results = await Promise.all(
    ALL_TYPES.map(async (type) => {
      const model = getModel(type);
      const [items, count] = await Promise.all([
        model.findMany({ where, take: 3, select: searchAllSelect }),
        model.count({ where }),
      ]);
      return { type, count, items: items.map(serializeRow) };
    })
  );

  return { categories: results };
}
