import { AppError, ValidationError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { makeBuildingKey } from '../lib/realEstateBuildingIdentity.js';
import type {
  DateWindow,
  HomeMarket,
  MarketCount,
  MarketRegion,
  PropertyType,
  RecentBuilding,
  SectionResult,
} from '../types/housingRedesign.js';
import {
  buildRegionFilter,
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
  GWANGJU_GU_BJD,
} from './cityMapping.js';
import { regionFilterToSql } from './realEstateService.js';
import { attachRealEstateCanonicalPaths } from './realEstateUrlRegistry.js';

const CACHE_TTL_MS = 60 * 60 * 1000;
const PARTIAL_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MERGED_REGION_SLUG = 'jeonnamgwangju';
const LEGACY_MERGED_SLUGS = new Set(['gwangju', 'jeonnam']);
const PROPERTY_TABLES: Record<PropertyType, string> = {
  apt: 'AptSaleTransaction',
  villa: 'VillaSaleTransaction',
  offitel: 'OffitelSaleTransaction',
};

type QueryClient = Pick<typeof prisma, '$queryRawUnsafe'>;

interface RawCountRow {
  date: string | Date;
  count: number | bigint;
}

interface RawRecentRow {
  dongName: string;
  type: PropertyType;
  transactionId: number;
  city: string;
  district: string;
  bjdCode: string;
  buildingName: string;
  jibun: string | null;
  date: string | Date;
  amount: number | bigint;
  area: string | { toString(): string } | null;
}

interface RegionRow {
  bjdCode: string;
  city: string;
  district: string;
  slug: string;
}

interface ResolvedRegion {
  input: { city?: string; district?: string };
  queryCity?: string;
  queryDistrict?: string;
  label: string;
  districtLimit: string[];
}

interface CacheEntry {
  value: HomeMarket;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<HomeMarket>>();

export function buildMarketCount(window: DateWindow, rows: Array<{ date: string; count: number | bigint }>): MarketCount {
  const byDate = new Map(rows.map((row) => [row.date, Number(row.count)]));
  const daily: MarketCount['daily'] = [];

  for (
    const day = new Date(`${window.from}T00:00:00Z`);
    day.toISOString().slice(0, 10) <= window.to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    daily.push({ date, count: byDate.get(date) ?? 0 });
  }

  return { total: daily.reduce((sum, day) => sum + day.count, 0), daily };
}

export async function getHomeMarket(
  region: { city?: string; district?: string },
  now = new Date(),
): Promise<HomeMarket> {
  const window = getThirtyDayWindow(now);
  const key = cacheKey(region, window.to);
  const cached = cache.get(key);
  const nowMs = Date.now();

  if (cached && cached.expiresAt > nowMs) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.value;
  }

  if (cached) {
    cache.delete(key);
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  const promise = loadHomeMarket(region, window, now);
  inflight.set(key, promise);
  const cleanup = (): void => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  };
  promise.then(cleanup, cleanup);
  return promise;
}

export function __resetHomeMarketCacheForTest(): void {
  cache.clear();
  inflight.clear();
}

async function loadHomeMarket(
  inputRegion: { city?: string; district?: string },
  window: DateWindow,
  now: Date,
): Promise<HomeMarket> {
  const resolved = await resolveRegion(inputRegion);
  const counts = await settleCounts(resolved, window);
  const recent = await settleRecent(resolved, window);
  const result: HomeMarket = {
    region: toMarketRegion(resolved),
    window,
    generatedAt: now.toISOString(),
    counts,
    recent,
  };

  const countResults = Object.values(counts);
  const allCountsFailed = countResults.every((section) => section.status === 'error');
  const allQueriesFailed = allCountsFailed && recent.status === 'error';
  if (allQueriesFailed) {
    throw new AppError(503, '홈 시장 정보를 일시적으로 불러올 수 없습니다.', 'UNAVAILABLE');
  }

  const hasPartialFailure = countResults.some((section) => section.status === 'error') || recent.status === 'error';
  remember(cacheKey(inputRegion, window.to), result, hasPartialFailure ? PARTIAL_CACHE_TTL_MS : CACHE_TTL_MS);
  return result;
}

async function resolveRegion(input: { city?: string; district?: string }): Promise<ResolvedRegion> {
  if (!input.city && input.district) {
    throw new ValidationError('city is required when district is provided');
  }

  if (!input.city) {
    return { input, label: '전국', districtLimit: [] };
  }

  const queryCity = CITY_SLUG_TO_FULL[input.city];
  if (!queryCity) {
    throw new ValidationError('unknown city slug');
  }

  const rows = await prisma.region.findMany({
    where: { city: { in: regionLookupCities(input.city, queryCity) } },
    select: { bjdCode: true, city: true, district: true, slug: true },
    orderBy: { district: 'asc' },
  }) as RegionRow[];
  const scopedRows = rows.filter((row) => belongsToSelectedCity(input.city!, row));
  if (scopedRows.length === 0) {
    throw new ValidationError('city has no known districts');
  }

  const districtLimit = scopedRows.map((row) => row.district);
  if (input.district) {
    const match = scopedRows.find((row) => row.slug === input.district);
    if (!match) {
      throw new ValidationError('district does not belong to city');
    }

    return {
      input,
      queryCity,
      queryDistrict: match.district,
      label: `${CITY_SLUG_TO_SHORT[input.city] ?? queryCity} ${match.district}`,
      districtLimit,
    };
  }

  return {
    input,
    queryCity,
    label: CITY_SLUG_TO_SHORT[input.city] ?? queryCity,
    districtLimit,
  };
}

function regionLookupCities(citySlug: string, queryCity: string): string[] {
  const lookup = new Set([queryCity, CITY_SLUG_TO_SHORT[citySlug]].filter(Boolean));
  if (LEGACY_MERGED_SLUGS.has(citySlug)) {
    lookup.add(CITY_SLUG_TO_FULL[MERGED_REGION_SLUG]);
  }
  return [...lookup];
}

function belongsToSelectedCity(citySlug: string, row: RegionRow): boolean {
  if (citySlug === 'gwangju') {
    return GWANGJU_GU_BJD.has(row.bjdCode);
  }

  if (citySlug === 'jeonnam') {
    return row.city === CITY_SLUG_TO_FULL[MERGED_REGION_SLUG] && !GWANGJU_GU_BJD.has(row.bjdCode);
  }

  return true;
}

async function settleCounts(
  region: ResolvedRegion,
  window: DateWindow,
): Promise<Record<PropertyType, SectionResult<MarketCount>>> {
  const entries = await Promise.all(
    propertyTypes().map(async (property) => {
      try {
        const rows = await queryCount(prisma, PROPERTY_TABLES[property], region, window);
        return [property, { status: 'ok', data: buildMarketCount(window, normalizeCountRows(rows)) }] as const;
      } catch {
        return [property, unavailable<MarketCount>()] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<PropertyType, SectionResult<MarketCount>>;
}

async function settleRecent(region: ResolvedRegion, window: DateWindow): Promise<SectionResult<RecentBuilding[]>> {
  const settled = await Promise.allSettled(
    propertyTypes().map((property) => queryRecent(prisma, property, PROPERTY_TABLES[property], region, window)),
  );

  if (settled.some((result) => result.status === 'rejected')) {
    return unavailable<RecentBuilding[]>();
  }

  const fulfilled = settled.filter(
    (result): result is PromiseFulfilledResult<RecentBuilding[]> => result.status === 'fulfilled',
  );
  const rows = fulfilled.flatMap((result) => result.value);
  rows.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    return b.transactionId - a.transactionId;
  });

  return { status: 'ok', data: rows.slice(0, 5) };
}

async function queryCount(
  db: QueryClient,
  table: string,
  region: ResolvedRegion,
  window: DateWindow,
): Promise<RawCountRow[]> {
  const dateExpr = dealDateExpression();
  const { clauses, params } = buildWhereClauses(region, window);
  const sql = `
    SELECT DATE_FORMAT(${dateExpr}, '%Y-%m-%d') AS date, COUNT(*) AS count
    FROM \`${table}\`
    WHERE ${clauses.join(' AND ')}
    GROUP BY DATE_FORMAT(${dateExpr}, '%Y-%m-%d')
    ORDER BY date ASC
  `;

  return db.$queryRawUnsafe<RawCountRow[]>(sql, ...params);
}

async function queryRecent(
  db: QueryClient,
  property: PropertyType,
  table: string,
  region: ResolvedRegion,
  window: DateWindow,
): Promise<RecentBuilding[]> {
  const dateExpr = dealDateExpression();
  const { clauses, params } = buildWhereClauses(region, window);
  const sql = `
    SELECT type, transactionId, city, district, bjdCode, buildingName, dongName, jibun, date, amount, area
    FROM (
      SELECT
        ? AS type,
        id AS transactionId,
        city,
        district,
        bjdCode,
        buildingName,
        dongName,
        jibun,
        DATE_FORMAT(${dateExpr}, '%Y-%m-%d') AS date,
        dealAmount AS amount,
        CAST(exclusiveArea AS CHAR) AS area,
        ROW_NUMBER() OVER (
          PARTITION BY city, district, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')
          ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
        ) AS rn
      FROM \`${table}\`
      WHERE ${clauses.join(' AND ')}
    ) ranked
    WHERE rn = 1
    ORDER BY date DESC, type ASC, transactionId DESC
    LIMIT 5
  `;

  const rows = await db.$queryRawUnsafe<RawRecentRow[]>(sql, property, ...params);
  const items = rows.map((row) => ({
    type: row.type,
    transactionId: row.transactionId,
    city: row.city,
    district: row.district,
    bjdCode: row.bjdCode,
    buildingName: row.buildingName,
    dongName: row.dongName,
    buildingKey: makeBuildingKey({ propertyType: row.type, bjdCode: row.bjdCode, buildingName: row.buildingName, dongName: row.dongName ?? '', jibun: row.jibun }),
    jibun: row.jibun,
    date: formatDateValue(row.date),
    amount: Number(row.amount),
    area: row.area === null ? null : Number(row.area).toFixed(2),
  }));
  const itemsForUrl = items.map(({ type: _type, ...item }) => item);
  const withCanonicalPaths = await attachRealEstateCanonicalPaths(itemsForUrl, `${property}-sale`);
  return withCanonicalPaths.map((item, index) => ({ ...item, type: items[index].type }));
}

function buildWhereClauses(region: ResolvedRegion, window: DateWindow): { clauses: string[]; params: unknown[] } {
  const dateExpr = dealDateExpression();
  const filter = buildRegionFilter(region.queryCity, region.queryDistrict);
  const regionSql = regionFilterToSql(filter);
  const clauses = [
    'dealDay IS NOT NULL',
    `${dateExpr} BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')`,
    '(cancelDealDay IS NULL OR cancelDealDay = \'\')',
    '(cancelDealType IS NULL OR cancelDealType = \'\')',
    ...regionSql.clauses,
  ];
  const params: unknown[] = [window.from, window.to, ...regionSql.params];

  if (region.queryCity && !region.queryDistrict && region.districtLimit.length > 0) {
    clauses.push(`district IN (${region.districtLimit.map(() => '?').join(', ')})`);
    params.push(...region.districtLimit);
  }

  return { clauses, params };
}

function dealDateExpression(): string {
  return 'STR_TO_DATE(CONCAT(dealYear, \'-\', dealMonth, \'-\', dealDay), \'%Y-%c-%e\')';
}

function normalizeCountRows(rows: RawCountRow[]): Array<{ date: string; count: number | bigint }> {
  return rows.map((row) => ({ date: formatDateValue(row.date), count: row.count }));
}

function formatDateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function getThirtyDayWindow(now: Date): DateWindow {
  const to = kstDateString(now);
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function kstDateString(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function toMarketRegion(region: ResolvedRegion): MarketRegion {
  return {
    city: region.input.city ?? null,
    district: region.input.district ?? null,
    label: region.label,
  };
}

function unavailable<T>(): SectionResult<T> {
  return { status: 'error', data: null, code: 'UNAVAILABLE' };
}

function propertyTypes(): PropertyType[] {
  return ['apt', 'villa', 'offitel'];
}

function cacheKey(region: { city?: string; district?: string }, toDate: string): string {
  return `${region.city ?? 'all'}:${region.district ?? 'all'}:${toDate}`;
}

function remember(key: string, value: HomeMarket, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}
