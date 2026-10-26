import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { makeBuildingKey } from '../lib/realEstateBuildingIdentity.js';
import { readSummaryMode, summaryTableFor, type SummaryTable } from '../lib/realEstateSummaryStore.js';
import { parseSearchQueryCached, resolveScope } from './search/searchQueryParser.js';
import { buildRegionFilter } from './cityMapping.js';
import { getLatestDeals, LATEST_DEAL_INDEX, latestDealsKey } from './realEstateLatestDeals.js';
import { attachRealEstateCanonicalPaths, getDeferredRealEstateIdentity } from './realEstateUrlRegistry.js';
import {
  attachNearbyAreaDeals,
  loadNearbyTargetArea,
  type NearbyAreaDeal,
  type NearbyTargetArea,
} from './realEstateNearbyArea.js';
import type { BuildingKey, DealScope, LatestDeals, PropertyType } from '../types/realEstateExploration.js';

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
  type?: RealEstateType;
  buildingKey?: string | null;
  canonicalPath?: string;
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  jibun?: string | null;
  transactionCount: number;
  latestPrice: number | null;
  lat: number | null;
  lng: number | null;
  lastDealYear: number | null;
  lastDealMonth: number | null;
  buildYear: number | null;
  latestDeals: LatestDeals;
}

export interface SearchAllResult {
  categories: Array<{
    type: RealEstateType;
    count: number;
    items: unknown[];
  }>;
  buildingCounts: { apt: number; villa: number; offitel: number };
}

interface SearchAllPreviewItem {
  type: RealEstateType;
  buildingKey?: string | null;
  canonicalPath?: string;
  buildingName: string;
  bjdCode: string;
  dongName?: string | null;
  jibun?: string | null;
  latestDeals?: LatestDeals;
}

interface LatestDealKeyInput {
  type?: RealEstateType;
  buildingName: string;
  bjdCode: string;
  dongName?: string | null;
  jibun?: string | null;
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

function buildMonthCutoff(months: number): { cutoff: Date; orWhere: object[] } {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return {
    cutoff,
    orWhere: [
      { dealYear: { gt: cutoff.getFullYear() } },
      { dealYear: cutoff.getFullYear(), dealMonth: { gte: cutoff.getMonth() + 1 } },
    ],
  };
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
 * BigInt → Number 변환 (JSON 직렬화 호환, Decimal은 Prisma가 문자열로 직렬화)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeRow(row: any): any {
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

  if (months) {
    const { orWhere } = buildMonthCutoff(months);
    where.OR = orWhere;
  }

  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let select: Record<string, any>;
  if (isSaleType(type)) {
    select = {
      id: true, buildingName: true, bjdCode: true, city: true, district: true, dongName: true,
      floor: true, exclusiveArea: true, buildYear: true,
      dealYear: true, dealMonth: true, dealDay: true,
      dealAmount: true, dealType: true, buyerType: true, sellerType: true,
      cancelDealDay: true,
    };
  } else {
    select = {
      id: true, buildingName: true, bjdCode: true, city: true, district: true, dongName: true,
      floor: true, exclusiveArea: true, buildYear: true,
      dealYear: true, dealMonth: true, dealDay: true,
      deposit: true, monthlyRent: true, rentType: true,
      contractType: true, contractTerm: true,
      preDeposit: true, preMonthlyRent: true,
    };
  }

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
        { id: 'desc' },
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

  let cutoff: Date | null = null;
  if (months) {
    const { cutoff: c, orWhere } = buildMonthCutoff(months);
    cutoff = c;
    where.OR = orWhere;
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

// Valid-name SQL fragment (must stay character-identical to sitemapService.ts getRealEstateCityDistrictHubs)
const VALID_NAME_SQL = `
  buildingName IS NOT NULL
  AND buildingName != ''
  AND CHAR_LENGTH(buildingName) >= 2
`;

interface SummaryRawRow {
  type?: RealEstateType;
  buildingKey?: string | null;
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  jibun?: string | null;
  transactionCount: number | bigint;
  latestPrice: bigint | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  buildYear: number | null;
  lat: string | null;
  lng: string | null;
}

function buildSummarySearch(
  type: string,
  city?: string,
  district?: string,
  nameText?: string,
): { whereClause: string; params: unknown[]; regionScoped: boolean } {
  const region = regionFilterToSql(buildRegionFilter(city, district));
  const conditions: string[] = ['type = ?', VALID_NAME_SQL, ...region.clauses];
  const params: unknown[] = [type, ...region.params];
  if (nameText) {
    conditions.push('buildingName LIKE CONCAT(?, \'%\')');
    params.push(nameText);
  }
  return { whereClause: conditions.join(' AND '), params, regionScoped: region.clauses.length > 0 };
}

// 지역 조건 없는 COUNT 는 옵티마이저가 [type, buildingKey] 로 행마다 본 테이블을 읽는다.
// VALID_NAME 조건이 buildingName 만 보므로 [type, buildingName] 커버링 인덱스로 세면 결과는 같고
// 인덱스(V2 기준 29MB)만 읽는다. 지역 조건이 있으면 지역 인덱스가 더 좁으므로 옵티마이저에 맡긴다.
function summaryCountIndexHint(table: SummaryTable, regionScoped: boolean): string {
  return regionScoped ? '' : ` FORCE INDEX (${table}_type_buildingName_idx)`;
}

const SUMMARY_RECENT_ORDER_SQL = 'latestDealYear DESC, latestDealMonth DESC, transactionCount DESC, buildingName ASC, bjdCode ASC';

function currentSummaryMode() {
  return readSummaryMode(process.env);
}

function listSummaryTable(): SummaryTable {
  return summaryTableFor('list', currentSummaryMode());
}

function keyedDetailSummaryTable(): SummaryTable {
  return summaryTableFor('keyed-detail', currentSummaryMode());
}

function summarySelectColumns(table: SummaryTable, includeType = false): string {
  const identity = table === 'RealEstateBuildingSummaryV2'
    ? 'buildingKey, jibun'
    : 'NULL AS buildingKey, NULL AS jibun';
  return `${includeType ? 'type, ' : ''}buildingName, ${identity}, bjdCode, city, district, dongName, transactionCount,
              latestPrice, latestDealYear, latestDealMonth, buildYear, lat, lng`;
}

function propertyPartitionKey(table: SummaryTable): string {
  return table === 'RealEstateBuildingSummaryV2' ? 'buildingKey' : 'type, buildingName, bjdCode';
}

function propertyDistinctCount(table: SummaryTable): string {
  return table === 'RealEstateBuildingSummaryV2' ? 'COUNT(DISTINCT buildingKey)' : 'COUNT(DISTINCT type, buildingName, bjdCode)';
}

function summaryRankedSelect(table: SummaryTable): string {
  return table === 'RealEstateBuildingSummaryV2'
    ? 's.*'
    : 's.*, NULL AS buildingKey, NULL AS jibun';
}

function propertyTypeFromRealEstateType(type: string): PropertyType {
  if (type.startsWith('apt-')) return 'apt';
  if (type.startsWith('villa-')) return 'villa';
  if (type.startsWith('offitel-')) return 'offitel';
  throw new Error(`Unknown real estate type: ${type}`);
}

function dealScopeForRealEstateType(type: string): DealScope {
  return type.endsWith('-sale') ? 'sale' : 'rent';
}

function toComplexItem(row: SummaryRawRow): ComplexItem {
  return {
    type: row.type,
    buildingKey: row.buildingKey ?? null,
    buildingName: row.buildingName,
    bjdCode: row.bjdCode,
    city: row.city,
    district: row.district,
    dongName: row.dongName,
    jibun: row.jibun ?? null,
    transactionCount: Number(row.transactionCount),
    latestPrice: row.latestPrice != null ? Number(row.latestPrice) : null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    lastDealYear: row.latestDealYear,
    lastDealMonth: row.latestDealMonth,
    buildYear: row.buildYear,
    latestDeals: { sale: null, jeonse: null, wolse: null },
  };
}

function latestDealKeyForItem(
  item: LatestDealKeyInput,
  fallbackType?: string,
): BuildingKey {
  const type = item.type ?? fallbackType;
  if (!type) throw new Error('Real estate type is required for latest deal enrichment');
  return {
    propertyType: propertyTypeFromRealEstateType(type),
    buildingName: item.buildingName,
    bjdCode: item.bjdCode,
    dongName: item.dongName,
    jibun: item.jibun ?? null,
  };
}

async function enrichComplexItems<T extends ComplexItem>(
  items: T[],
  scope: DealScope,
  fallbackType?: string,
): Promise<T[]> {
  if (items.length === 0) return items;
  const keys = items.map((item) => latestDealKeyForItem(item, fallbackType));
  const bundles = await getLatestDeals(keys, scope);
  return items.map((item, index) => ({
    ...item,
    latestDeals: bundles.get(latestDealsKey(keys[index]))!,
  }));
}

async function attachAndEnrichComplexItems<T extends ComplexItem>(
  items: T[],
  scope: DealScope,
  fallbackType?: string,
): Promise<T[]> {
  const withCanonicalPaths = await attachRealEstateCanonicalPaths(items, fallbackType);
  return enrichComplexItems(withCanonicalPaths, scope, fallbackType);
}

/**
 * 건물 목록 조회 — RealEstateBuildingSummary 테이블.
 * 유효 단지명 필터(사이트맵 getRealEstateCityDistrictHubs와 동일 조건)를 적용하여
 * 지번/숫자 건물명을 제외한다.
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

  const { whereClause, params, regionScoped } = buildSummarySearch(type, city, district, buildingName);
  const offset = (page - 1) * limit;
  const summaryTable = listSummaryTable();

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<SummaryRawRow[]>(
      `SELECT ${summarySelectColumns(summaryTable)}
       FROM ${summaryTable}
       WHERE ${whereClause}
       ORDER BY ${SUMMARY_RECENT_ORDER_SQL}
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ),
    prisma.$queryRawUnsafe<[{ total: bigint }]>(
      `SELECT COUNT(*) AS total FROM ${summaryTable}${summaryCountIndexHint(summaryTable, regionScoped)} WHERE ${whereClause}`,
      ...params,
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: await attachAndEnrichComplexItems(rows.map(toComplexItem), dealScopeForRealEstateType(type), type),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

/**
 * 키워드 기반 건물 목록 조회 — /search 드릴다운(더보기) 전용.
 *
 * searchAll(미리보기 카운트)과 동일하게 키워드를 파서로 지역/이름으로 해석한다.
 * 지역 키워드(예: "강남", "전남광주")는 buildingName LIKE가 아니라 지역 필터로 스코프되어
 * 미리보기 카운트와 드릴다운 결과가 일관된다. (getComplexList의 buildingName-prefix 경로는
 * 지역 키워드에 대해 0건을 반환하던 버그.)
 *
 * region/name 모두 ?-파라미터 바인딩 — SQL 인젝션 안전. summary 사전집계 테이블만 조회하고
 * groupBy/앱메모리 distinct를 쓰지 않아 OOM 위험이 없다. 반환 shape은 getComplexList와 동일.
 */
export async function searchComplexesByKeyword(
  type: string,
  keyword: string,
  page: number = 1,
  limit: number = 20
): Promise<ComplexListResult> {
  if (!TABLE_NAME_MAP[type]) throw new Error(`Unknown real estate type: ${type}`);

  const parsed = await parseSearchQueryCached(keyword);
  const { effectiveCity, effectiveDistrict, nameText } = resolveScope({}, parsed);
  const hasName = !!(nameText && nameText.length >= 2);
  const hasRegion = !!(effectiveCity || effectiveDistrict);
  // 순수 카테고리어/1자 등 지역·이름 어느 쪽으로도 해석 안 되면 전체 스캔 방지 — DB 접근 없이 종료.
  if (!hasName && !hasRegion) return { items: [], total: 0, page, totalPages: 0 };

  const { whereClause, params } = buildSummarySearch(type, effectiveCity, effectiveDistrict, hasName ? nameText : undefined);
  const offset = (page - 1) * limit;
  const summaryTable = listSummaryTable();

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<SummaryRawRow[]>(
      `SELECT ${summarySelectColumns(summaryTable)}
       FROM ${summaryTable}
       WHERE ${whereClause}
       ORDER BY ${SUMMARY_RECENT_ORDER_SQL}
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ),
    prisma.$queryRawUnsafe<[{ total: bigint }]>(
      `SELECT COUNT(*) AS total FROM ${summaryTable} WHERE ${whereClause}`,
      ...params,
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: await attachAndEnrichComplexItems(rows.map(toComplexItem), dealScopeForRealEstateType(type), type),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function searchPropertyComplexesByKeyword(
  propertyType: RealEstatePropertyType,
  keyword: string | undefined,
  page: number = 1,
  limit: number = 20
): Promise<ComplexListResult> {
  const types = PROPERTY_TYPES[propertyType];
  if (!types) throw new Error(`Unknown real estate property type: ${propertyType}`);

  const parsed = await parseSearchQueryCached(keyword);
  const { effectiveCity, effectiveDistrict, nameText } = resolveScope({}, parsed);
  const hasName = !!(nameText && nameText.length >= 2);
  const hasRegion = !!(effectiveCity || effectiveDistrict);
  if (!hasName && !hasRegion) return { items: [], total: 0, page, totalPages: 0 };

  const region = regionFilterToSql(buildRegionFilter(effectiveCity, effectiveDistrict));
  const conditions = [`type IN (${types.map(() => '?').join(', ')})`, VALID_NAME_SQL, ...region.clauses];
  const params: unknown[] = [...types, ...region.params];
  if (hasName) {
    conditions.push('buildingName LIKE CONCAT(?, \'%\')');
    params.push(nameText);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;
  const summaryTable = listSummaryTable();
  const partitionKey = propertyPartitionKey(summaryTable);
  const distinctCount = propertyDistinctCount(summaryTable);

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<SummaryRawRow[]>(
      `SELECT ${summarySelectColumns(summaryTable, true)}
       FROM (
         SELECT ${summaryRankedSelect(summaryTable)},
                ROW_NUMBER() OVER (
                  PARTITION BY ${partitionKey}
                  ORDER BY ${SUMMARY_RECENT_ORDER_SQL}
                ) AS rn
         FROM ${summaryTable} s
         WHERE ${whereClause}
       ) ranked
       WHERE rn = 1
       ORDER BY ${SUMMARY_RECENT_ORDER_SQL}
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ),
    prisma.$queryRawUnsafe<[{ total: bigint }]>(
      `SELECT ${distinctCount} AS total FROM ${summaryTable} WHERE ${whereClause}`,
      ...params,
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: await attachAndEnrichComplexItems(rows.map(toComplexItem), 'all'),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────
// getBuildingInfo
// ─────────────────────────────────────────────

export interface BuildingInfo {
  buildingKey?: string;
  canonicalPath?: string;
  legacyGrouped?: boolean;
  bjdCode: string;
  buildingName: string;
  city: string;
  district: string;
  dongName: string | null;
  roadName: string | null;
  jibun: string | null;
  buildYear: number | null;
  minArea: number | null;
  maxArea: number | null;
  /** sale: 매매가(만원). rent: 보증금(만원). */
  latestDealAmount: number | null;
  /** rent에서만 의미. 월세 금액(만원). 전세 거래는 0. */
  latestMonthlyRent: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  lat: number | null;
  lng: number | null;
  /** rent 타입에서만 채워지는 건물-레벨 전세/월세 거래 건수 */
  jeonseCount?: number;
  wolseCount?: number;
  /**
   * 반환된 건물이 요청한 시군구 안에 있는가.
   *
   * false = buildingName 만으로 전국에서 재해석한 결과라 요청 지역과 시군구가 다르다.
   * 프론트가 이 신호로 실제 지역 URL 로 301 하거나(통합) noindex 로 떨어뜨린다.
   * null 로 되돌리지 않는 이유: 프론트가 "어디로 합칠지"를 알려면 실제 지역이 필요하다.
   */
  regionMatched?: boolean;
}

async function attachBuildingCanonicalPath(type: string, building: BuildingInfo | null): Promise<BuildingInfo | null> {
  if (!building) return null;
  if (!building.buildingKey && building.canonicalPath) return building;
  const [withCanonicalPath] = await attachRealEstateCanonicalPaths([building], type);
  return withCanonicalPath;
}

/** 법정동코드의 시군구 부분(시도 2 + 시군구 3 = 앞 5자리). 근거가 없으면 null. */
export function sigunguPrefix(bjdCode: string | null | undefined): string | null {
  if (!bjdCode) return null;
  const prefix = bjdCode.trim().slice(0, 5);
  return prefix.length === 5 ? prefix : null;
}

/**
 * 이름으로 재해석한 bjdCode 가 요청한 시군구와 같은가.
 *
 * 어느 한쪽의 시군구 코드를 못 읽으면(빈 힌트 등) "어긋났다고 단정하지 않는다"(true).
 * 근거 없는 false 는 멀쩡한 상세를 301/noindex 로 보내버리므로 fail-open 이 안전하다.
 */
export function isSameSigunguBjdCode(
  requestedBjdCode: string | null | undefined,
  resolvedBjdCode: string | null | undefined
): boolean {
  const requested = sigunguPrefix(requestedBjdCode);
  const resolved = sigunguPrefix(resolvedBjdCode);
  if (!requested || !resolved) return true;
  return requested === resolved;
}

/**
 * 건물 정보 집계 - 최신 거래 1건 + 면적 min/max
 *
 * bjdCode가 비어 있으면 buildingName만으로 거래가 가장 많은 bjdCode를 선택한다.
 * 외부 유입(쿼리 파라미터 누락)에서도 canonical/색인이 가능하도록 하기 위함.
 *
 * ⚠️ 그 재해석은 전국 groupBy 라서 요청 지역 밖의 건물을 돌려줄 수 있다. 프로덕션 실측
 * (2026-09-04): /villa-sale/{seoul/gangnam, busan/haeundae, daegu/suseong}/현대 세 URL이
 * 모두 200·index·self-canonical 로 "제주 서귀포시 현대" 문서를 렌더했다 — 흔한 건물명 하나가
 * (구·군 250 × 타입 6) 만큼의 동일 title 문서를 발행한 셈이다(중복 title 22.5만 건의 주범).
 * 그래서 재해석 자체는 유지하되(stale summary 회수용) `regionMatched` 로 드러내, 호출부가
 * 301 통합/noindex 를 선택할 수 있게 한다.
 */
export async function getBuildingInfo(
  type: string,
  bjdCode: string,
  buildingName: string,
  buildingKey?: string
): Promise<BuildingInfo | null> {
  const model = getModel(type);
  let ambiguousAddress = false;
  const deferredIdentity = buildingKey ? null : await getDeferredRealEstateIdentity(type, bjdCode, buildingName);
  let parcelRows: Array<{ dongName: string; jibun: string | null }> | undefined;
  if (buildingKey) {
    if (bjdCode && !/^(\d{5}|\d{10})$/.test(bjdCode)) return null;
    const summaryTable = keyedDetailSummaryTable();
    const matches = await prisma.$queryRawUnsafe<Array<{ bjdCode: string; buildingName: string; dongName: string; jibun: string | null }>>(
      `SELECT bjdCode, buildingName, dongName, jibun FROM ${summaryTable} WHERE type = ? AND buildingKey = ? AND buildingName = ? AND (? = '' OR bjdCode = ?) LIMIT 1`,
      type, buildingKey, buildingName, bjdCode, bjdCode,
    );
    const match = matches[0];
    if (!match) return null;
    bjdCode = match.bjdCode;
    // Keep raw spellings for Prisma filters, while matching the normalized parcel.
    parcelRows = await prisma.$queryRawUnsafe<Array<{ dongName: string; jibun: string | null }>>(
      `SELECT DISTINCT dongName, jibun FROM ${getTableName(type)} WHERE bjdCode = ? AND buildingName = ? AND TRIM(dongName) = ? AND COALESCE(TRIM(jibun), '') = ?`,
      bjdCode, buildingName, match.dongName.trim(), match.jibun?.trim() ?? '',
    );
    if (parcelRows.length === 0) return null;
  }

  // buildingName으로 거래가 가장 많은 bjdCode를 고른다.
  const resolveBjdCodeByName = async (): Promise<string | null> => {
    const top = await model.groupBy({
      by: ['bjdCode'],
      where: { buildingName },
      _count: { _all: true },
      orderBy: { _count: { bjdCode: 'desc' } },
      take: 1,
    });
    return top.length === 0 ? null : top[0].bjdCode;
  };

  const priceField = isSaleType(type) ? 'dealAmount' : 'deposit';
  const areaField = 'exclusiveArea';
  // 거래일 desc → id desc tie-break: 같은 날 다건이어도 '최신 1건'이 결정적으로 고정된다.
  // 검색 엔드포인트(searchTransactions) 와 동일 규칙이라 meta·헤더가 같은 거래를 선택한다.
  const orderBy = [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }, { id: 'desc' }];

  // 특정 bjdCode 로 BuildingInfo 를 조립한다. 해당 bjdCode 에 거래가 없으면 null.
  const buildForBjdCode = async (
    effectiveBjdCode: string,
    regionMatched: boolean
  ): Promise<BuildingInfo | null> => {
    const groupedIdentity = deferredIdentity?.bjdCode === effectiveBjdCode ? deferredIdentity : null;
    // sale 은 취소거래(cancelDealDay)를 제외 — searchTransactions/getTransactionStats 와 정렬.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { bjdCode: effectiveBjdCode, buildingName };
    if (isSaleType(type)) where.cancelDealDay = null;
    if (parcelRows) where.OR = parcelRows;

    const [latest, agg, dongGroups] = await Promise.all([
      model.findFirst({
        where,
        orderBy,
      }),
      model.aggregate({
        where,
        _min: { [areaField]: true },
        _max: { [areaField]: true },
      }),
      model.groupBy({
        by: ['dongName', 'jibun'],
        where,
        _count: { dongName: true },
        orderBy: { _count: { dongName: 'desc' } },
      }),
    ]);

    if (!latest) return null;
    const parcelKeys = new Set(dongGroups.map((row: { dongName: string; jibun?: string | null }) =>
      JSON.stringify([row.dongName?.trim() ?? '', row.jibun?.trim() ?? ''])));
    if (!buildingKey && !groupedIdentity && parcelKeys.size > 1) {
      ambiguousAddress = true;
      return null;
    }

    let jeonseCount: number | undefined
    let wolseCount: number | undefined
    if (!isSaleType(type)) {
      [jeonseCount, wolseCount] = await Promise.all([
        model.count({ where: { ...where, rentType: '전세' } }),
        model.count({ where: { ...where, rentType: '월세' } }),
      ])
    }

    const representativeDongName: string | null = groupedIdentity ? null : dongGroups[0]?.dongName ?? null;

    let lat = latest.lat;
    let lng = latest.lng;

    if (lat === null || lng === null) {
      const latestWithCoords = await model.findFirst({
        where: {
          ...where,
          lat: { not: null },
          lng: { not: null },
        },
        orderBy,
        select: {
          lat: true,
          lng: true,
        },
      });

      lat = latestWithCoords?.lat ?? null;
      lng = latestWithCoords?.lng ?? null;
    }

    return {
      ...(buildingKey ? { buildingKey } : groupedIdentity ? {} : {
        buildingKey: makeBuildingKey({ propertyType: type.split('-')[0], bjdCode: effectiveBjdCode, buildingName: latest.buildingName, dongName: latest.dongName ?? '', jibun: latest.jibun ?? null }),
      }),
      ...(groupedIdentity ? { canonicalPath: groupedIdentity.canonicalPath, legacyGrouped: true as const } : {}),
      bjdCode: effectiveBjdCode,
      buildingName: latest.buildingName,
      city: latest.city,
      district: latest.district,
      dongName: representativeDongName,
      roadName: groupedIdentity ? null : latest.roadName ?? null,
      jibun: groupedIdentity ? null : latest.jibun ?? null,
      buildYear: latest.buildYear ?? null,
      minArea: agg._min[areaField] !== null && agg._min[areaField] !== undefined ? Number(agg._min[areaField]) : null,
      maxArea: agg._max[areaField] !== null && agg._max[areaField] !== undefined ? Number(agg._max[areaField]) : null,
      latestDealAmount: latest[priceField] !== null ? Number(latest[priceField]) : null,
      latestMonthlyRent: isSaleType(type)
        ? null
        : (latest.monthlyRent !== null && latest.monthlyRent !== undefined ? Number(latest.monthlyRent) : null),
      latestDealYear: latest.dealYear,
      latestDealMonth: latest.dealMonth,
      lat: groupedIdentity || lat === null ? null : Number(lat),
      lng: groupedIdentity || lng === null ? null : Number(lng),
      jeonseCount,
      wolseCount,
      regionMatched,
    };
  };

  // bjdCode 는 강한 조건이 아니라 "힌트"로 취급한다.
  // getComplexList(summary 테이블)에서 온 bjdCode 가 트랜잭션과 어긋나도
  // (stale summary / startsWith 오매칭) buildingName 으로 회수해서,
  // 사이트맵엔 있는데 상세는 buildingInfo=null → false noindex 가 되는 것을 막는다.
  // happy-path(힌트 유효)에는 추가 쿼리가 없고, 힌트가 빗나간 경우에만 1회 재해석한다.
  if (bjdCode) {
    // 힌트가 그대로 통했으면 요청 지역 그대로다 — 추가 쿼리도, 지역 비교도 필요 없다.
    const fromHint = await buildForBjdCode(bjdCode, true);
    if (fromHint) return attachBuildingCanonicalPath(type, fromHint);
    if (buildingKey || deferredIdentity || ambiguousAddress) return null;
  }

  const resolvedBjdCode = await resolveBjdCodeByName();
  if (!resolvedBjdCode || resolvedBjdCode === bjdCode) return null;
  // 재해석 결과가 요청 시군구를 벗어났으면 regionMatched=false 로 드러낸다(호출부가 301/noindex 결정).
  return attachBuildingCanonicalPath(type, await buildForBjdCode(resolvedBjdCode, isSameSigunguBjdCode(bjdCode, resolvedBjdCode)));
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

  const areaField = 'exclusiveArea';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { bjdCode };
  if (buildingName) where.buildingName = buildingName;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupByResult: any[] = await model.groupBy({
    by: [areaField],
    where,
    _count: { [areaField]: true },
  });

  // Math.round 반올림 후 ±2㎡ 그룹 병합
  const raw = groupByResult
    .filter((row) => row[areaField] !== null && row[areaField] !== undefined)
    .map((row) => ({
      area: Math.round(Number(row[areaField])),
      count: row._count[areaField] as number,
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
];

/**
 * buildRegionFilter() 결과(Prisma where 조각)를 raw-SQL 조각 + 파라미터로 변환한다.
 * city-variant(서울/서울특별시) 로직을 중복 없이 재사용하기 위한 순수 함수 — DB 접근 없음.
 * COUNT(DISTINCT ...) 같은 raw 쿼리에서 `IN (?, ?)` 파라미터 바인딩에 사용한다.
 */
export function regionFilterToSql(filter: Record<string, unknown>): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const city = filter.city;
  if (city && typeof city === 'object' && city !== null && 'in' in (city as object)) {
    const arr = (city as { in: string[] }).in;
    if (arr.length) { clauses.push(`city IN (${arr.map(() => '?').join(', ')})`); params.push(...arr); }
  } else if (typeof city === 'string') {
    clauses.push('city = ?'); params.push(city);
  }
  if (typeof filter.district === 'string') { clauses.push('district = ?'); params.push(filter.district); }
  return { clauses, params };
}

/** 유형별(apt/villa/offitel) 유니크 건물수 집계용 — 각 유형의 sale/rent 테이블 타입 묶음. */
const PROPERTY_GROUPS = [
  { pt: 'apt' as const, types: ['apt-sale', 'apt-rent'] },
  { pt: 'villa' as const, types: ['villa-sale', 'villa-rent'] },
  { pt: 'offitel' as const, types: ['offitel-sale', 'offitel-rent'] },
];

const PROPERTY_TYPES = {
  apt: ['apt-sale', 'apt-rent'],
  villa: ['villa-sale', 'villa-rent'],
  offitel: ['offitel-sale', 'offitel-rent'],
} as const;

export type RealEstatePropertyType = keyof typeof PROPERTY_TYPES;

/**
 * 통합 검색 - 6개 테이블 buildingName LIKE 검색 (병렬)
 */
export async function searchAll(
  keyword?: string,
  city?: string,
  district?: string
): Promise<SearchAllResult> {
  const parsed = await parseSearchQueryCached(keyword);
  const { effectiveCity, effectiveDistrict, nameText } = resolveScope({ city, district }, parsed);

  // 순수 카테고리 키워드("화장실")는 부동산 검색 의도가 아님 — DB 접근 없이 종료.
  // freeText 2자 미만(예: "강")도 buildingName 필터를 못 만들어 전체 스캔이 되므로 동일 처리.
  const hasName = !!(nameText && nameText.length >= 2);
  const hasRegion = !!(effectiveCity || effectiveDistrict);
  if (!hasName && !hasRegion) {
    return { categories: [], buildingCounts: { apt: 0, villa: 0, offitel: 0 } };
  }

  const results = await Promise.all(
    ALL_TYPES.map(async (type) => {
      const isSale = isSaleType(type);
      const { whereClause, params } = buildSummarySearch(type, effectiveCity, effectiveDistrict, hasName ? nameText : undefined);

      // 거래 원본 groupBy(수백만 행) 대신 사전집계 summary(인덱스 커버) 사용
      const summaryTable = listSummaryTable();
      const [rows, buildingCount] = await Promise.all([
        prisma.$queryRawUnsafe<SummaryRawRow[]>(
          `SELECT ${summarySelectColumns(summaryTable)}
           FROM ${summaryTable}
           WHERE ${whereClause}
           ORDER BY ${SUMMARY_RECENT_ORDER_SQL}
           LIMIT ?`,
          ...params,
          3,
        ),
        prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT COUNT(*) AS total FROM ${summaryTable} WHERE ${whereClause}`,
          ...params,
        ),
      ]);

      const items = await attachRealEstateCanonicalPaths(rows.map((r) => serializeRow({
        type,
        buildingKey: r.buildingKey,
        buildingName: r.buildingName,
        bjdCode: r.bjdCode,
        city: r.city,
        district: r.district,
        dongName: r.dongName,
        jibun: r.jibun ?? null,
        buildYear: r.buildYear,
        dealYear: r.latestDealYear,
        dealMonth: r.latestDealMonth,
        dealAmount: isSale ? r.latestPrice : null,
        deposit: !isSale ? r.latestPrice : null,
        transactionCount: r.transactionCount,
      }) as SearchAllPreviewItem), type);

      return { type, count: Number(buildingCount[0]?.total ?? 0), items };
    })
  );

  const allItems = results.flatMap((result) => result.items as SearchAllPreviewItem[]);
  if (allItems.length > 0) {
    const keys = allItems.map((item) => latestDealKeyForItem(item));
    const bundles = await getLatestDeals(keys, 'all');
    for (const [index, item] of allItems.entries()) {
      item.latestDeals = bundles.get(latestDealsKey(keys[index]))!;
    }
  }

  // 유형별(apt/villa/offitel) 유니크 건물수 — sale/rent 두 테이블에 걸친 동일 건물의 이중카운트 제거.
  // RealEstateBuildingSummary는 type별 행이라 매매+전월세를 함께 가진 건물이
  // per-type count에서 두 번 잡힌다. 앱메모리 distinct(과거 2GB OOM)를 피해 DB-side로 COUNT(DISTINCT ...).
  // type IN (?, ?)는 고정 상수 배열 값이라 안전, region/name 파라미터는 바인딩으로 전달.
  const region = regionFilterToSql(buildRegionFilter(effectiveCity, effectiveDistrict));
  const summaryTable = listSummaryTable();
  const distinctCounts = await Promise.all(PROPERTY_GROUPS.map(async ({ types }) => {
    const clauses = ['type IN (?, ?)', VALID_NAME_SQL, ...region.clauses];
    const params: unknown[] = [types[0], types[1], ...region.params];
    if (hasName) { clauses.push(`buildingName LIKE CONCAT(?, '%')`); params.push(nameText); }
    const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT ${propertyDistinctCount(summaryTable)} AS c FROM ${summaryTable} WHERE ${clauses.join(' AND ')}`,
      ...params,
    );
    return Number(rows[0]?.c ?? 0);
  }));
  const buildingCounts = { apt: distinctCounts[0], villa: distinctCounts[1], offitel: distinctCounts[2] };

  return { categories: results, buildingCounts };
}

// ─────────────────────────────────────────────
// getNearbyByBjd
// ─────────────────────────────────────────────

export type NearbyMode = 'sale' | 'rent';
export type NearbyRentType = 'all' | 'jeonse' | 'wolse';
export type NearbyPropertyKey = 'apt' | 'villa' | 'offitel';

export interface NearbyComplex {
  buildingKey?: string | null;
  canonicalPath?: string;
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  jibun?: string | null;
  buildYear: number | null;
  transactionCount: number;
  /** sale: 매매가(만원). rent: 보증금(만원). */
  latestPrice: number | null;
  /** rent에서만 의미. 월세 금액(만원). 전세는 0. */
  monthlyRent: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  lat: number | null;
  lng: number | null;
  /** 최근 36개월 거래 수(모든 면적, 해당 모드·rentType 반영) */
  recentCount3y?: number;
  /** 비교 면적(없으면 대표 면적)의 최근 36개월 최신 거래 1건 */
  areaDeal?: NearbyAreaDeal | null;
}

export interface NearbyResult extends Record<NearbyPropertyKey, NearbyComplex[]> {
  /** 현재 단지의 비교 면적(상세 overview defaultAreaGroup 과 같은 규칙). type 미지정이면 null. */
  targetArea: NearbyTargetArea | null;
}

const NEARBY_PROPERTY_KEYS: NearbyPropertyKey[] = ['apt', 'villa', 'offitel'];

const RENT_TRANSACTION_TABLE: Record<NearbyPropertyKey, string> = {
  apt: 'AptRentTransaction',
  villa: 'VillaRentTransaction',
  offitel: 'OffitelRentTransaction',
};


interface NearbySummaryRawRow extends SummaryRawRow {
  monthlyRent: number | bigint | null;
  latestDealDay: number | null;
}

function summaryNearbySelectColumns(table: SummaryTable): string {
  const identity = table === 'RealEstateBuildingSummaryV2'
    ? 'buildingKey, jibun'
    : 'NULL AS buildingKey, NULL AS jibun';
  return `buildingName, ${identity}, bjdCode, city, district, dongName, buildYear, transactionCount,
          latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay, lat, lng`;
}

async function fetchNearbyFromSummary(
  type: string,
  bjdCode: string,
  opts: { dongName: string | null; excludeBuildingName: string | null; limitPerType: number },
): Promise<NearbyComplex[]> {
  const summaryTable = listSummaryTable();
  const conditions = ['type = ?', 'bjdCode = ?'];
  const params: unknown[] = [type, bjdCode];
  if (opts.dongName) {
    conditions.push('dongName = ?');
    params.push(opts.dongName);
  }
  if (opts.excludeBuildingName) {
    conditions.push('buildingName != ?');
    params.push(opts.excludeBuildingName);
  }

  const rows = await prisma.$queryRawUnsafe<NearbySummaryRawRow[]>(
    `SELECT ${summaryNearbySelectColumns(summaryTable)}
     FROM ${summaryTable}
     WHERE ${conditions.join(' AND ')}
     ORDER BY latestDealYear DESC, latestDealMonth DESC, transactionCount DESC
     LIMIT ?`,
    ...params,
    opts.limitPerType,
  );

  return attachRealEstateCanonicalPaths(rows.map((r) => ({
    buildingKey: r.buildingKey ?? null,
    buildingName: r.buildingName,
    bjdCode: r.bjdCode,
    city: r.city,
    district: r.district,
    dongName: r.dongName,
    jibun: r.jibun ?? null,
    buildYear: r.buildYear ?? null,
    transactionCount: Number(r.transactionCount),
    latestPrice: r.latestPrice != null ? Number(r.latestPrice) : null,
    monthlyRent: r.monthlyRent != null ? Number(r.monthlyRent) : null,
    latestDealYear: r.latestDealYear ?? null,
    latestDealMonth: r.latestDealMonth ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
  })), type);
}

// ── 인근 단지 전세/월세 필터(rent + jeonse|wolse) ─────────────────────
// 옛 구현은 법정동(+동)의 전 기간 해당 rentType 거래를 전부
//   ROW_NUMBER() OVER (PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '')
//                      ORDER BY dealYear DESC, dealMonth DESC, COALESCE(dealDay, 0) DESC, id DESC)
// 로 정렬한 뒤 파티션별 COUNT 와 rn = 1 행을 붙여 ORDER BY 최신 연·월 DESC, 건수 DESC LIMIT n 했다
// (운영 송도동 전세 1.56s — 시간 대부분이 동 전체 거래의 창 정렬).
// 지금은
//   1) 같은 WHERE 로 파티션별 GROUP BY 집계만(COUNT, 최신 연·월) — 정렬 없는 임시 테이블 집계 — 해서 상위 n 개 파티션만 고르고
//   2) 고른 파티션마다 LATERAL (… ORDER BY 최신순 LIMIT 1) 로 최신 행을 [buildingName, bjdCode, dealYear, dealMonth, dealDay]
//      인덱스 역방향 스캔으로 읽는다(#949 getLatestDeals 와 같은 방식, 왕복 1회).
//
// 결과가 옛 구현과 같은 근거:
// a) 파티션: GROUP BY 식이 옛 PARTITION BY 식과 같고 같은 컬럼 콜레이션으로 묶는다. LATERAL 의 등호 네 개도 같은 콜레이션
//    비교라 정확히 그 파티션의 행만(옛 WHERE 그대로 함께 걸어) 읽는다.
// b) 최신 행: 옛 rn = 1 은 (연, 월, COALESCE(일, 0), id) 최대 행이다. MySQL DESC 정렬은 NULL 을 맨 뒤에 두므로
//    `dealDay DESC` 는 일자가 1 이상인 한 `COALESCE(dealDay, 0) DESC` 와 같은 순서다(일자 0·음수는 수집 원본에 없다 —
//    로컬 전월세 3종 전 행 확인). id 는 PK 라 전순서가 되어 고르는 행이 하나로 같다.
// c) 최신 연·월: rn = 1 행의 (연, 월) = 파티션의 (연, 월) 사전순 최대 = MAX(dealYear * 100 + dealMonth)(월 1~12).
// d) 표시 값: 옛 counts CTE 는 창 정렬 순서로 물질화된 ranked 를 임시 테이블로 집계해, 파티션에서 처음 만난 행 = rn = 1
//    행의 값을 GROUP BY 키(buildingName·TRIM(dongName)·COALESCE(TRIM(jibun), ''))와 ANY_VALUE(city·district·buildYear)로
//    냈다. 그래서 이 값들도 전부 LATERAL 로 읽은 최신 행에서 꺼낸다(파티션 안에서 값이 갈리는 단지도 옛 값과 같다).
// e) 순서·LIMIT 경계: 정렬 키는 옛과 같은 (최신 연·월 DESC, 건수 DESC) 뿐이다. 그 이상 동률인 단지끼리의 순서와 LIMIT 경계에서
//    어느 단지가 남는지는 옛 쿼리도 SQL 로 정해져 있지 않았다(실제로는 filesort 우선순위 큐가 입력 순서에 따라 정함 — 파티션
//    식 순서도 아니다). 그래서 동률 묶음 안 순서·경계 선택은 옛과 다를 수 있고, 그 밖의 결과(어느 (연, 월, 건수) 묶음에 어떤
//    단지가 몇 개, 각 단지의 값)는 같다. 동률 순서를 결정적으로 고정할지는 별도 결정(현재 동작을 바꾸므로 여기서 추가하지 않음).
//
// 인덱스 힌트는 LATEST_DEAL_INDEX(#949)와 같은 이름을 쓴다. 이름이 없는 환경에서는 경고만 나고 무시되어 결과는 같다.
export function nearbyRentFilteredSql(
  key: NearbyPropertyKey,
  bjdCode: string,
  rentType: Exclude<NearbyRentType, 'all'>,
  opts: { dongName: string | null; excludeBuildingName: string | null; limitPerType: number },
): Prisma.Sql {
  const tableName = RENT_TRANSACTION_TABLE[key];
  const table = Prisma.raw(`\`${tableName}\``);
  const hint = Prisma.raw(`/*+ INDEX(lt ${LATEST_DEAL_INDEX[tableName as keyof typeof LATEST_DEAL_INDEX]}) */`);
  // 옛 SQL 과 같이 rentType 은 리터럴로 둔다(값은 고정 두 가지).
  const rentTypeValue = Prisma.raw(rentType === 'jeonse' ? "'전세'" : "'월세'");
  // 옛 WHERE 와 같은 조건. 별칭만 바꿔 1단계(t)·2단계(lt)에 똑같이 건다.
  const where = (alias: 't' | 'lt'): Prisma.Sql => {
    const a = Prisma.raw(alias);
    const dongFilter = opts.dongName
      ? Prisma.sql`AND TRIM(${a}.dongName) = ${opts.dongName.trim()}`
      : Prisma.empty;
    const excludeFilter = opts.excludeBuildingName
      ? Prisma.sql`AND ${a}.buildingName != ${opts.excludeBuildingName}`
      : Prisma.empty;
    return Prisma.sql`${a}.bjdCode = ${bjdCode}
          AND ${a}.rentType = ${rentTypeValue}
          ${dongFilter}
          ${excludeFilter}`;
  };

  return Prisma.sql`
      WITH grouped AS (
        SELECT
          t.buildingName,
          t.bjdCode,
          TRIM(t.dongName) AS dongKey,
          COALESCE(TRIM(t.jibun), '') AS jibunKey,
          COUNT(*) AS transactionCount,
          MAX(t.dealYear * 100 + t.dealMonth) AS latestYm
        FROM ${table} t
        WHERE ${where('t')}
        GROUP BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')
        ORDER BY latestYm DESC, transactionCount DESC
        LIMIT ${opts.limitPerType}
      )
      SELECT
        latest.buildingName,
        latest.bjdCode,
        latest.city,
        latest.district,
        TRIM(latest.dongName) AS dongName,
        COALESCE(TRIM(latest.jibun), '') AS jibun,
        latest.buildYear,
        g.transactionCount,
        latest.deposit AS latestPrice,
        latest.monthlyRent,
        latest.dealYear AS latestDealYear,
        latest.dealMonth AS latestDealMonth
      FROM grouped g
      INNER JOIN LATERAL (
        SELECT ${hint}
          lt.buildingName, lt.bjdCode, lt.city, lt.district, lt.dongName, lt.jibun, lt.buildYear,
          lt.deposit, lt.monthlyRent, lt.dealYear, lt.dealMonth
        FROM ${table} lt
        WHERE lt.buildingName = g.buildingName
          AND lt.bjdCode = g.bjdCode
          AND TRIM(lt.dongName) = g.dongKey
          AND COALESCE(TRIM(lt.jibun), '') = g.jibunKey
          AND ${where('lt')}
        ORDER BY lt.dealYear DESC, lt.dealMonth DESC, lt.dealDay DESC, lt.id DESC
        LIMIT 1
      ) latest ON TRUE
      ORDER BY g.latestYm DESC, g.transactionCount DESC
    `;
}

export async function getNearbyByBjd(
  bjdCode: string,
  mode: NearbyMode,
  opts: {
    rentType?: NearbyRentType;
    dongName?: string;
    excludeBuildingName?: string;
    limitPerType?: number;
    /** 현재 상세 페이지 유형. 주면 targetArea 를 계산하고 같은 유형 탭에서 같은 면적을 비교한다. */
    type?: RealEstateType;
    /** 현재 단지 지번(overview identity 와 같은 주소 범위). '' = 지번 없음, 미지정 = 동까지만. */
    jibun?: string;
    /**
     * 비교 면적 키(ROUND(전용면적)). 주면 기본 면적 계산 대신 이 값을 쓴다.
     * 현재 단지를 특정할 수 없으면(excludeBuildingName·dongName 없음) 라벨은 키 그대로다.
     */
    areaKey?: string;
    now?: Date;
  }
): Promise<NearbyResult> {
  const rentType: NearbyRentType = opts.rentType ?? 'all';
  const dongName = opts.dongName ?? null;
  const excludeBuildingName = opts.excludeBuildingName ?? null;
  const limitPerType = opts.limitPerType ?? 4;
  const now = opts.now ?? new Date();
  const result: NearbyResult = { apt: [], villa: [], offitel: [], targetArea: null };

  // 현재 단지 비교 면적: summary 조회와 병렬로 1회. 같은 면적 거래 조회(유형당 1회)는 summary 결과가 나온 뒤.
  const currentProperty = opts.type ? propertyTypeFromRealEstateType(opts.type) : null;
  // dongName 이 없으면(상세 buildingInfo 미확보) bjdCode 전체를 이름으로 묶지 않는다 — overview 와 다른 거래 집합이 된다.
  const loadTarget = async (): Promise<NearbyTargetArea | null> => {
    if (!opts.type || !currentProperty) return null;
    if (!excludeBuildingName || !dongName) {
      return opts.areaKey ? { key: opts.areaKey, label: opts.areaKey } : null;
    }
    return loadNearbyTargetArea({
      property: currentProperty,
      prefer: SALE_TYPES.includes(opts.type) ? 'sale' : 'jeonse',
      bjdCode,
      buildingName: excludeBuildingName,
      dongName,
      jibun: opts.jibun ?? null,
      areaKey: opts.areaKey ?? null,
      now,
    });
  };
  // 보조 정보라 실패해도 인근 단지 목록(내부 링크)은 살린다 — targetArea=null 로 강등.
  const targetPromise: Promise<NearbyTargetArea | null> = loadTarget().catch((err: unknown) => {
    console.warn(`[nearby] targetArea 조회 실패 — null 로 강등 (${bjdCode}): ${err instanceof Error ? err.message : String(err)}`);
    return null;
  });
  const withAreaDeals = async (key: NearbyPropertyKey, rows: NearbyComplex[]): Promise<NearbyComplex[]> => {
    if (rows.length === 0) return rows;
    const target = await targetPromise;
    try {
      return await attachNearbyAreaDeals({
        property: key,
        mode,
        rentType: mode === 'rent' ? rentType : 'all',
        bjdCode,
        items: rows,
        targetKey: target?.key ?? null,
        sameProperty: key === currentProperty,
        now,
      });
    } catch (err) {
      // 같은 면적 최근가가 실패해도 기본 행은 그대로 — 프론트는 areaDeal 이 없으면 기존 최근가로 표시한다.
      console.warn(`[nearby] ${key} 면적 거래 조회 실패 — 기본 행으로 강등 (${bjdCode}): ${err instanceof Error ? err.message : String(err)}`);
      return rows;
    }
  };

  if (mode === 'sale') {
    // Sale path: summary 테이블 — 매매가만 필요.
    // 3종(apt/villa/offitel)은 서로 독립이므로 병렬로 던진다. 순차 await 이면 벽시계가
    // max 가 아니라 합계가 된다(실측 0.096+0.196+0.037=0.329s).
    const saleEntries = await Promise.all(
      NEARBY_PROPERTY_KEYS.map(async (key) => {
        const type = `${key}-sale`;
        const rows = await fetchNearbyFromSummary(type, bjdCode, { dongName, excludeBuildingName, limitPerType });
        return [key, await withAreaDeals(key, rows.map((row) => ({ ...row, monthlyRent: null })))] as const;
      }),
    );
    for (const [key, items] of saleEntries) result[key] = items;
    result.targetArea = await targetPromise;
    return result;
  }

  // Rent + rentType='all': summary 테이블 경로. sale 과 동일하게 인덱스를 타므로 밀리초대다.
  //
  // summary 는 (type, buildingName, bjdCode) 단위로 최신 거래 1건을 들고 있어 전세/월세를
  // 한 행으로 합친다. 따라서 rentType 필터가 걸린 경우에는 쓸 수 없고 아래 raw 경로로 간다.
  // 다만 SSR 은 selectedRentType 기본값이 'all' 이라 **항상 이 경로**를 탄다 — 크롤러가
  // 때리는 경로이자 야간 sync 부하에 30초 타임아웃이 나던 바로 그 경로다.
  // (2026-08-03 03:45~04:15 KST 실측: 평균 8.08s, 타임아웃 21건, 5xx 27건 중 22건이 rent)
  if (rentType === 'all') {
    const entries = await Promise.all(
      NEARBY_PROPERTY_KEYS.map(async (key) => {
        const type = `${key}-rent`;
        const rows = await fetchNearbyFromSummary(type, bjdCode, { dongName, excludeBuildingName, limitPerType });
        return [key, await withAreaDeals(key, rows)] as const;
      }),
    );
    for (const [key, items] of entries) result[key] = items;
    result.targetArea = await targetPromise;
    return result;
  }

  // Rent + 전세/월세 필터: summary 가 rentType 을 구분하지 않으므로 transaction 테이블 raw SQL.
  // `?mode=jeonse|wolse` URL 을 SSR 할 때도 타므로 크롤러 노출이 있다(2026-10-17 OCI 부하 시험 DB CPU 1위).
  // sale 과 마찬가지로 3종은 독립이라 병렬로 던진다. SQL 과 옛 구현과의 동등성 근거는 nearbyRentFilteredSql 주석.
  const rentEntries = await Promise.all(NEARBY_PROPERTY_KEYS.map(async (key) => {
    // Prisma raw query에서 COUNT/INT 컬럼은 BigInt로 직렬화될 수 있어
    // 모든 숫자 컬럼을 bigint | number 로 받고 Number()로 명시적 변환한다.
    const rows = await prisma.$queryRaw<Array<{
      buildingName: string;
      bjdCode: string;
      city: string;
      district: string;
      dongName: string;
      jibun: string | null;
      buildYear: bigint | number | null;
      transactionCount: bigint | number;
      latestPrice: bigint | number | null;
      monthlyRent: bigint | number | null;
      latestDealYear: bigint | number | null;
      latestDealMonth: bigint | number | null;
    }>>(nearbyRentFilteredSql(key, bjdCode, rentType, { dongName, excludeBuildingName, limitPerType }));

    return [key, await withAreaDeals(key, rows.map((r) => ({
      buildingName: r.buildingName,
      bjdCode: r.bjdCode,
      city: r.city,
      district: r.district,
      dongName: r.dongName,
      jibun: r.jibun ?? null,
      buildYear: r.buildYear != null ? Number(r.buildYear) : null,
      transactionCount: Number(r.transactionCount),
      latestPrice: r.latestPrice != null ? Number(r.latestPrice) : null,
      monthlyRent: r.monthlyRent != null ? Number(r.monthlyRent) : null,
      latestDealYear: r.latestDealYear != null ? Number(r.latestDealYear) : null,
      latestDealMonth: r.latestDealMonth != null ? Number(r.latestDealMonth) : null,
      lat: null,
      lng: null,
    })))] as const;
  }));
  for (const [key, items] of rentEntries) result[key] = items;
  result.targetArea = await targetPromise;

  return result;
}

// ─────────────────────────────────────────────
// getApartmentPriceAnalysis
// ─────────────────────────────────────────────

export interface PriceAnalysisResult {
  pricePerPyeong: number | null;
  jeonseRatio: number | null;
  allTimeHigh: number | null;
  allTimeLow: number | null;
  saleCount: number;
}

export async function getApartmentPriceAnalysis(
  bjdCode: string,
  buildingName: string,
): Promise<PriceAnalysisResult | null> {
  const [saleAgg, rentAgg] = await Promise.all([
    prisma.aptSaleTransaction.aggregate({
      where: {
        bjdCode,
        buildingName,
        cancelDealDay: null,
      },
      _avg: { dealAmount: true, exclusiveArea: true },
      _max: { dealAmount: true },
      _min: { dealAmount: true },
      _count: { id: true },
    }),
    prisma.aptRentTransaction.aggregate({
      where: {
        bjdCode,
        buildingName,
        rentType: '전세',
      },
      _avg: { deposit: true },
    }),
  ]);

  if (!saleAgg._count.id || !saleAgg._avg.dealAmount) return null;

  const avgDeal = Number(saleAgg._avg.dealAmount);
  const avgArea = saleAgg._avg.exclusiveArea ? Number(saleAgg._avg.exclusiveArea) : null;
  const maxDeal = saleAgg._max.dealAmount !== null ? Number(saleAgg._max.dealAmount) : null;
  const minDeal = saleAgg._min.dealAmount !== null ? Number(saleAgg._min.dealAmount) : null;
  const avgJeonse = rentAgg._avg.deposit ? Number(rentAgg._avg.deposit) : null;

  const pricePerPyeong =
    avgArea && avgArea > 0 ? Math.round(avgDeal / (avgArea / 3.3058)) : null;

  const jeonseRatio =
    avgJeonse && avgDeal > 0 ? Math.round((avgJeonse / avgDeal) * 100) : null;

  return {
    pricePerPyeong,
    jeonseRatio,
    allTimeHigh: maxDeal !== null ? Math.round(maxDeal) : null,
    allTimeLow: minDeal !== null ? Math.round(minDeal) : null,
    saleCount: saleAgg._count.id,
  };
}
