import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import {
  dealDateExpression,
  overviewDateThrough,
  saleNotCanceled,
  validKnownDateThrough,
} from '../lib/realEstateDealSql.js';
import {
  PRICE_BASIS,
  areaGroupKey,
  buildAreaGroups,
  chooseDefaultAreaGroup,
  classifyDeals,
  computePriceBasis,
  groupByArea,
  labelAreaGroups,
  monthsBefore,
  type BasisDeal,
} from '../lib/realEstatePriceBasis.js';
import {
  getBuildingInfo,
  getTableName,
  serializeRow,
  type RealEstateType,
  type BuildingInfo,
} from './realEstateService.js';
import {
  exactDealDateFilter,
  getDetailWindow,
  normalizeAreaGroupParam,
} from './realEstateExactFilter.js';
import {
  getRealEstateCanonicalPath,
  isPreservedRealEstateUrlMode,
} from './realEstateUrlRegistry.js';
import type {
  AreaOption,
  DealFlag,
  DealMode,
  DealPoint,
  DetailIdentity,
  DetailOverview,
  DetailPage,
  DetailQuery,
  DetailSnapshot,
  LatestSale,
  PeriodMonths,
  PriceBasis,
  SerializedTransaction,
} from '../types/housingRedesign.js';

const PAGE_SIZE = 15;
const SALE_TYPES = new Set<RealEstateType>(['apt-sale', 'villa-sale', 'offitel-sale']);

export type QueryClient = Pick<typeof prisma, '$queryRaw'>;

/**
 * 대표 시세 로드 범위: 기본 면적 창 36개월 + 6개월.
 * 6개월은 예전 이상거래 판정용 여유였지만, 오버뷰 면적 그룹(칩·라벨)이 바뀌지 않도록 범위는 그대로 둔다.
 */
const BASIS_LOAD_MONTHS = PRICE_BASIS.defaultAreaMonths + 6;

export interface RawDetailPoint {
  id: number;
  date: string | Date;
  amount: number | bigint;
  area: string | Prisma.Decimal;
  floor: number | null;
  deposit: number | bigint | null;
}

interface TableConfig {
  type: RealEstateType;
  table: string;
  property: 'apt' | 'villa' | 'offitel';
  isSale: boolean;
}

interface NormalizedDetailFilter {
  table: TableConfig;
  identity: DetailIdentity;
  mode: DealMode;
  months: PeriodMonths;
  /** 면적 그룹 키 */
  area: string;
  deposit: number | null;
}

interface RawAreaCountRow {
  area: string | Prisma.Decimal;
  total: number | bigint;
  recent: number | bigint | Prisma.Decimal | null;
}

interface AreaChoice {
  options: AreaOption[];
  defaultKey: string | null;
  /** 매매·전세 모드에서 전 기간 거래의 표시 태그(직거래 여부). 월세는 null. */
  flags: Map<number, DealFlag> | null;
}

interface RawDepositRow {
  amount: number | bigint;
  count: number | bigint;
}

interface RawCountRow {
  total?: number | bigint;
  count?: number | bigint;
}

interface RawLatestSaleRow {
  id: number;
  dealAmount: number | bigint;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
  exclusiveArea: string | Prisma.Decimal | null;
  floor: number | null;
}

interface RawAreaBoundsRow {
  minArea: string | Prisma.Decimal | null;
  maxArea: string | Prisma.Decimal | null;
}

interface RawAddressRow {
  dongName: string;
  jibun: string | null;
  roadName: string | null;
}

interface RawLocationRow {
  lat: string | number | Prisma.Decimal | null;
  lng: string | number | Prisma.Decimal | null;
}

interface RawBasisDealRow {
  id: number;
  date: string | Date;
  amount: number | bigint | Prisma.Decimal;
  area: string | Prisma.Decimal;
  floor: number | null;
  direct: number | bigint | boolean | null;
}

interface RawWindowRow {
  fromDate: string | Date | null;
}

export function serializeDetailPoints(rows: RawDetailPoint[], flags?: Map<number, DealFlag>): DealPoint[] {
  return rows.map((row) => ({
    id: row.id,
    date: formatDateValue(row.date),
    amount: toNumber(row.amount),
    area: formatArea(row.area),
    floor: row.floor,
    deposit: row.deposit === null ? null : toNumber(row.deposit),
    flag: flags?.get(row.id) ?? 'normal',
  }));
}

export async function getDetailSnapshot(
  type: RealEstateType,
  query: DetailQuery,
  now = new Date(),
): Promise<DetailSnapshot<SerializedTransaction>> {
  const mode = validateMode(type, query.mode);
  const table = tableForMode(type, mode);
  const requestedWindow = getDetailWindow(now, query.months);
  const generatedAt = now.toISOString();
  const today = requestedWindow.to;
  const identity = await resolveDetailIdentity(type, query);

  return prisma.$transaction(async (tx) => {
    const { options: areas, defaultKey, flags: choiceFlags } = await getAreaChoice(tx, type, table, identity, mode, today);
    const requestedArea = normalizeAreaGroupParam(query.area);
    const area = chooseArea(areas, requestedArea, defaultKey);
    let adjustment: DetailSnapshot<SerializedTransaction>['adjustment'] =
      requestedArea !== null && area !== requestedArea ? 'area-reset' : null;

    if (!area) {
      return emptySnapshot(identity, mode, query.months, requestedWindow, areas, generatedAt, adjustment);
    }

    const areaWindow = query.months === 0
      ? await getRetainedDetailWindow(tx, table, identity, mode, today, area)
      : requestedWindow;
    const deposits = mode === 'wolse'
      ? await getDepositOptions(tx, table, identity, areaWindow, area)
      : [];
    const deposit = mode === 'wolse' ? chooseDeposit(deposits, query.deposit) : null;

    if (mode === 'wolse' && query.deposit !== undefined && deposit !== query.deposit && adjustment === null) {
      adjustment = 'deposit-reset';
    }

    if (mode === 'wolse' && deposit === null) {
      return emptySnapshot(identity, mode, query.months, areaWindow, areas, generatedAt, adjustment, deposits, area);
    }

    const window = query.months === 0 && mode === 'wolse' && deposit !== null
      ? await getRetainedDetailWindow(tx, table, identity, mode, today, area, deposit)
      : areaWindow;
    const normalized = { table, identity, mode, months: query.months, area, deposit };
    const pointRows = await getPointRows(tx, normalized, window);
    const total = await countRows(tx, normalized, window);
    const tableRows = await getTableRows(tx, normalized, window, 1);
    // 직거래 태그는 면적 선택 때 읽은 거래로 붙인다. 월세는 태그 없음.
    const flags = choiceFlags ?? undefined;

    return {
      filters: {
        ...identity,
        mode,
        months: query.months,
        area,
        deposit,
      },
      window,
      options: { areas, deposits },
      points: serializeDetailPoints(pointRows, flags),
      table: {
        items: tableRows.map((row) => serializeRow(row) as SerializedTransaction),
        total,
        page: 1,
        totalPages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
      },
      generatedAt,
      adjustment,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getDetailPage(
  type: RealEstateType,
  query: DetailQuery & { page: number },
  now = new Date(),
): Promise<DetailPage<SerializedTransaction>> {
  const mode = validateMode(type, query.mode);
  const table = tableForMode(type, mode);
  const area = normalizeAreaGroupParam(query.area);
  if (!area) {
    throw new Error('detail-page requires area group');
  }
  let deposit: number | null = null;
  if (mode === 'wolse') {
    if (query.deposit == null) {
      throw new Error('detail-page requires exact deposit for wolse');
    }
    deposit = query.deposit;
  }

  const requestedWindow = getDetailWindow(now, query.months);
  const today = requestedWindow.to;
  const identity = await resolveDetailIdentity(type, query);
  const normalized = {
    table,
    identity,
    mode,
    months: query.months,
    area,
    deposit,
  };
  const window = query.months === 0
    ? await getRetainedDetailWindow(prisma, table, identity, mode, today, area, deposit)
    : requestedWindow;
  const page = Math.max(1, Math.floor(query.page));
  const total = await countRows(prisma, normalized, window);
  const rows = await getTableRows(prisma, normalized, window, page);

  return {
    items: rows.map((row) => serializeRow(row) as SerializedTransaction),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
  };
}

export async function getDetailOverview(
  type: RealEstateType,
  identity: DetailIdentity,
  now = new Date(),
): Promise<DetailOverview | null> {
  const building = identity.buildingKey
    ? await getBuildingInfo(type, identity.bjdCode, identity.buildingName, identity.buildingKey)
    : await getBuildingInfo(type, identity.bjdCode, identity.buildingName);
  if (!building) return null;
  identity = await resolveDetailIdentity(type, identity, building);

  const saleTable = tableForMode(type, 'sale');
  const rentTable = tableForMode(type, 'jeonse');
  const window6m = getDetailWindow(now, 6);
  const generatedAt = now.toISOString();
  const today = window6m.to;

  const basisFrom = monthsBefore(today, BASIS_LOAD_MONTHS);

  const [latestSaleRows, countRowsResult, areaRows, rawAddresses, locationRows, saleDeals, jeonseDeals] = await Promise.all([
    prisma.$queryRaw<RawLatestSaleRow[]>(latestSaleSql(saleTable, identity, today)),
    prisma.$queryRaw<RawCountRow[]>(overviewSaleCountSql(saleTable, identity, window6m)),
    prisma.$queryRaw<RawAreaBoundsRow[]>(overviewAreaBoundsSql(saleTable, rentTable, identity, today)),
    prisma.$queryRaw<RawAddressRow[]>(overviewAddressesSql(saleTable, rentTable, identity)),
    prisma.$queryRaw<RawLocationRow[]>(overviewLocationSql(saleTable, rentTable, identity)),
    loadBasisDeals(prisma, type, identity, 'sale', today, basisFrom),
    loadBasisDeals(prisma, type, identity, 'jeonse', today, basisFrom),
  ]);

  const basisMode: 'sale' | 'jeonse' = SALE_TYPES.has(type) ? 'sale' : 'jeonse';
  const areaGroups = buildAreaGroups(saleDeals, jeonseDeals, today);
  const defaultAreaGroup = chooseDefaultAreaGroup(areaGroups, saleDeals, jeonseDeals, basisMode, today);

  const addresses = mergeReportedAddresses(rawAddresses);
  const locationAmbiguous = addresses.length > 1;
  const locationRow = locationRows[0];
  const location = !locationAmbiguous
    && locationRow?.lat !== undefined
    && locationRow.lng !== undefined
    && locationRow.lat !== null
    && locationRow.lng !== null
    ? { lat: toNumber(locationRow.lat), lng: toNumber(locationRow.lng) }
    : null;
  const areaBounds = areaRows[0] ?? { minArea: null, maxArea: null };

  return {
    identity,
    latestSale: serializeLatestSale(latestSaleRows[0] ?? null),
    buildYear: building.buildYear ?? null,
    minArea: areaBounds.minArea === null ? null : formatArea(areaBounds.minArea),
    maxArea: areaBounds.maxArea === null ? null : formatArea(areaBounds.maxArea),
    saleCount6m: toNumber(countRowsResult[0]?.count ?? countRowsResult[0]?.total ?? 0),
    window6m,
    addresses,
    location,
    locationAmbiguous,
    basisMode,
    defaultAreaGroup,
    areaGroups,
    saleBasis: priceBasisByGroup(saleDeals, today, PRICE_BASIS.saleSample),
    jeonseBasis: priceBasisByGroup(jeonseDeals, today, PRICE_BASIS.jeonseSample),
    generatedAt,
  };
}

/** 대표 시세 계산용 거래(취소 제외·유효 계약일·주소 범위). 매매는 dealAmount, 전세는 deposit. */
export async function loadBasisDeals(
  client: QueryClient,
  type: RealEstateType,
  identity: DetailIdentity,
  mode: 'sale' | 'jeonse',
  today: string,
  fromDate: string | null,
): Promise<BasisDeal[]> {
  const table = tableForMode(type, mode);
  const fromFilter = fromDate === null
    ? Prisma.empty
    : Prisma.sql`AND ${exactDealDateFilter({ from: fromDate, to: today }, 't')}`;
  const rows = await client.$queryRaw<RawBasisDealRow[]>(Prisma.sql`
    SELECT
      t.id,
      DATE_FORMAT(${dealDateExpression('t')}, '%Y-%m-%d') AS date,
      ${mode === 'sale' ? Prisma.sql`t.dealAmount` : Prisma.sql`t.deposit`} AS amount,
      CAST(t.exclusiveArea AS CHAR) AS area,
      t.floor,
      ${mode === 'sale' ? Prisma.sql`(t.dealType = '직거래')` : Prisma.sql`0`} AS direct
    FROM ${Prisma.raw(table.table)} t
    WHERE ${baseWhere(table, identity, mode)}
      AND ${validKnownDateThrough(today, 't')}
      AND ${requiredValueWhere(table, mode)}
      ${fromFilter}
  `);
  return rows.map((row) => ({
    id: row.id,
    date: formatDateValue(row.date),
    amount: toNumber(row.amount),
    area: formatArea(row.area),
    floor: row.floor,
    direct: Number(row.direct ?? 0) === 1,
  }));
}

function priceBasisByGroup(
  deals: BasisDeal[],
  today: string,
  sampleSize: number,
): Record<string, PriceBasis> {
  const groups = groupByArea(deals);
  const result: Record<string, PriceBasis> = {};
  for (const key of [...groups.keys()].sort((a, b) => Number(a) - Number(b))) {
    result[key] = computePriceBasis(groups.get(key) ?? [], today, sampleSize);
  }
  return result;
}

async function resolveDetailIdentity(type: RealEstateType, input: DetailIdentity, legacyBuilding?: BuildingInfo): Promise<DetailIdentity> {
  const identity: DetailIdentity = { bjdCode: input.bjdCode, buildingName: input.buildingName };
  if (!input.buildingKey) {
    const building = legacyBuilding ?? await getBuildingInfo(type, input.bjdCode, input.buildingName);
    if (!building || building.regionMatched === false || building.bjdCode !== input.bjdCode) {
      throw new NotFoundError('부동산 상세 정보를 찾을 수 없습니다.');
    }
    if (building.legacyGrouped) {
      return {
        ...identity,
        ...(building.canonicalPath ? { canonicalPath: building.canonicalPath } : {}),
        legacyGrouped: true,
      };
    }
    return {
      ...identity,
      ...(building.buildingKey ? { buildingKey: building.buildingKey } : {}),
      ...(building.canonicalPath ? { canonicalPath: building.canonicalPath } : {}),
      dongName: building.dongName?.trim() ?? '',
      jibun: building.jibun?.trim() || null,
    };
  }
  const rows = await prisma.$queryRaw<Array<{ dongName: string; jibun: string | null }>>(Prisma.sql`
    SELECT dongName, jibun FROM RealEstateBuildingSummaryV2
    WHERE type = ${type} AND buildingKey = ${input.buildingKey}
      AND bjdCode = ${input.bjdCode} AND buildingName = ${input.buildingName}
    LIMIT 1
  `);
  if (!rows[0]) throw new NotFoundError('부동산 상세 정보를 찾을 수 없습니다.');
  const preservedUrlMode = isPreservedRealEstateUrlMode();
  const canonicalPath = preservedUrlMode
    ? await getRealEstateCanonicalPath(type, input.buildingKey)
    : null;
  if (preservedUrlMode && !canonicalPath) {
    throw new Error(`Missing RealEstatePublicUrl mapping for ${type}:${input.buildingKey}`);
  }
  return {
    ...identity,
    buildingKey: input.buildingKey,
    ...(canonicalPath ? { canonicalPath } : {}),
    dongName: rows[0].dongName.trim(),
    jibun: rows[0].jibun?.trim() || null,
  };
}

function addressWhere(identity: DetailIdentity, alias: string): Prisma.Sql {
  if (identity.dongName === undefined) return Prisma.empty;
  return Prisma.sql`AND TRIM(${Prisma.raw(`${alias}.dongName`)}) = ${identity.dongName}
    AND COALESCE(TRIM(${Prisma.raw(`${alias}.jibun`)}), '') = ${identity.jibun ?? ''}`;
}

function mergeReportedAddresses(rows: RawAddressRow[]): RawAddressRow[] {
  const addresses = new Map<string, RawAddressRow>();
  for (const row of rows) {
    const address = { dongName: row.dongName.trim(), jibun: row.jibun?.trim() || null, roadName: row.roadName?.trim() || null };
    // Only a complete parcel can prove two differently written addresses are identical.
    const key = JSON.stringify(address.dongName && address.jibun
      ? [address.dongName, address.jibun]
      : [address.dongName, address.jibun, address.roadName]);
    const existing = addresses.get(key);
    if (!existing) addresses.set(key, address);
    else if (!existing.roadName && address.roadName) existing.roadName = address.roadName;
  }
  return [...addresses.values()];
}

function validateMode(type: RealEstateType, mode: DealMode): DealMode {
  if (SALE_TYPES.has(type) && mode !== 'sale') {
    throw new Error(`${type} only supports sale mode`);
  }
  if (!SALE_TYPES.has(type) && mode === 'sale') {
    throw new Error(`${type} only supports rent modes`);
  }
  return mode;
}

function tableForMode(type: RealEstateType, mode: DealMode): TableConfig {
  const property = type.split('-')[0] as TableConfig['property'];
  const tableType = `${property}-${mode === 'sale' ? 'sale' : 'rent'}` as RealEstateType;
  const table = getTableName(tableType);
  return { type: tableType, table, property, isSale: mode === 'sale' };
}

function chooseArea(areas: AreaOption[], requestedArea: string | null, defaultKey: string | null): string | null {
  if (areas.length === 0) return null;
  const keys = areas.map((option) => option.key);
  if (requestedArea !== null && keys.includes(requestedArea)) return requestedArea;
  if (defaultKey !== null && keys.includes(defaultKey)) return defaultKey;
  return keys[0] ?? null;
}

function chooseDeposit(deposits: Array<{ amount: number; count: number }>, requestedDeposit: number | undefined): number | null {
  if (deposits.length === 0) return null;
  if (requestedDeposit !== undefined && deposits.some((deposit) => deposit.amount === requestedDeposit)) {
    return requestedDeposit;
  }

  return [...deposits].sort((a, b) => b.count - a.count || a.amount - b.amount)[0].amount;
}

function emptySnapshot(
  identity: DetailIdentity,
  mode: DealMode,
  months: PeriodMonths,
  window: DetailSnapshot<SerializedTransaction>['window'],
  areas: AreaOption[],
  generatedAt: string,
  adjustment: DetailSnapshot<SerializedTransaction>['adjustment'],
  deposits: Array<{ amount: number; count: number }> = [],
  area: string | null = null,
): DetailSnapshot<SerializedTransaction> {
  return {
    filters: { ...identity, mode, months, area, deposit: null },
    window,
    options: { areas, deposits },
    points: [],
    table: { items: [], total: 0, page: 1, totalPages: 0 },
    generatedAt,
    adjustment,
  };
}

/**
 * 면적 그룹 옵션과 기본 그룹.
 * - 매매·전세: 전 기간 거래를 loadBasisDeals 로 읽어 옵션(라벨·36개월 수)을 만들고,
 *   기본 그룹은 오버뷰와 같은 chooseDefaultAreaGroup(현재 모드 쪽만 채움)으로 고른다. 읽은 거래는 직거래 태그에 재사용.
 * - 월세: 면적별 집계 1회, 기본 그룹은 36개월 거래 수 최대(동률이면 작은 키).
 */
async function getAreaChoice(
  client: QueryClient,
  type: RealEstateType,
  table: TableConfig,
  identity: DetailIdentity,
  mode: DealMode,
  today: string,
): Promise<AreaChoice> {
  if (mode === 'sale' || mode === 'jeonse') {
    const deals = await loadBasisDeals(client, type, identity, mode, today, null);
    const sale = mode === 'sale' ? deals : [];
    const jeonse = mode === 'jeonse' ? deals : [];
    const groups = buildAreaGroups(sale, jeonse, today);
    const options = groups.map((group) => ({
      key: group.key,
      label: group.label,
      count: mode === 'sale' ? group.saleCount36m : group.jeonseCount36m,
    }));
    return {
      options,
      defaultKey: chooseDefaultAreaGroup(groups, sale, jeonse, mode, today),
      flags: classifyDeals(deals),
    };
  }

  const recentFrom = monthsBefore(today, PRICE_BASIS.defaultAreaMonths);
  const rows = await client.$queryRaw<RawAreaCountRow[]>(Prisma.sql`
    SELECT
      CAST(t.exclusiveArea AS CHAR) AS area,
      COUNT(*) AS total,
      SUM(CASE WHEN ${dealDateExpression('t')} > ${recentFrom} THEN 1 ELSE 0 END) AS recent
    FROM ${Prisma.raw(table.table)} t
    WHERE ${baseWhere(table, identity, mode)}
      AND ${validKnownDateThrough(today, 't')}
      AND ${requiredValueWhere(table, mode)}
    GROUP BY t.exclusiveArea
  `);
  const acc = new Map<string, { areas: string[]; count: number }>();
  for (const row of rows) {
    const area = formatArea(row.area);
    const key = areaGroupKey(area);
    let group = acc.get(key);
    if (!group) {
      group = { areas: [], count: 0 };
      acc.set(key, group);
    }
    // labelAreaGroups 는 빈도 기준이므로 행 수만큼 넣는다.
    for (let i = 0; i < toNumber(row.total); i += 1) group.areas.push(area);
    group.count += toNumber(row.recent ?? 0);
  }
  const labels = labelAreaGroups(new Map([...acc.entries()].map(([key, group]) => [key, group.areas])));
  const options = [...acc.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([key, group]) => ({ key, label: labels.get(key) ?? '', count: group.count }));
  const defaultOption = [...options].sort((a, b) => b.count - a.count || Number(a.key) - Number(b.key))[0];
  return { options, defaultKey: defaultOption?.key ?? null, flags: null };
}

async function getRetainedDetailWindow(
  client: QueryClient,
  table: TableConfig,
  identity: DetailIdentity,
  mode: DealMode,
  today: string,
  area?: string,
  deposit?: number | null,
): Promise<DetailSnapshot<SerializedTransaction>['window']> {
  const areaFilter = area === undefined
    ? Prisma.empty
    : Prisma.sql`AND ${areaGroupWhere(area)}`;
  const depositFilter = mode === 'wolse' && deposit !== undefined && deposit !== null
    ? Prisma.sql`AND t.deposit = ${BigInt(deposit)}`
    : Prisma.empty;
  const rows = await client.$queryRaw<RawWindowRow[]>(Prisma.sql`
    SELECT DATE_FORMAT(MIN(${dealDateExpression('t')}), '%Y-%m-%d') AS fromDate
    FROM ${Prisma.raw(table.table)} t
    WHERE ${baseWhere(table, identity, mode)}
      AND ${validKnownDateThrough(today, 't')}
      AND ${requiredValueWhere(table, mode)}
      ${areaFilter}
      ${depositFilter}
  `);
  const from = rows[0]?.fromDate;
  return {
    from: from === null || from === undefined ? today : formatDateValue(from),
    to: today,
  };
}

async function getDepositOptions(
  client: QueryClient,
  table: TableConfig,
  identity: DetailIdentity,
  window: DetailSnapshot<SerializedTransaction>['window'],
  area: string,
): Promise<Array<{ amount: number; count: number }>> {
  const rows = await client.$queryRaw<RawDepositRow[]>(Prisma.sql`
    SELECT t.deposit AS amount, COUNT(*) AS count
    FROM ${Prisma.raw(table.table)} t
    WHERE ${baseWhere(table, identity, 'wolse')}
      AND ${exactDealDateFilter(window, 't')}
      AND ${areaGroupWhere(area)}
      AND ${requiredValueWhere(table, 'wolse')}
    GROUP BY t.deposit
    ORDER BY t.deposit ASC
  `);
  return rows.map((row) => ({ amount: toNumber(row.amount), count: toNumber(row.count) }));
}

async function getPointRows(
  client: QueryClient,
  filter: NormalizedDetailFilter,
  window: DetailSnapshot<SerializedTransaction>['window'],
): Promise<RawDetailPoint[]> {
  return client.$queryRaw<RawDetailPoint[]>(Prisma.sql`
    SELECT
      t.id,
      DATE_FORMAT(${dealDateExpression('t')}, '%Y-%m-%d') AS date,
      ${amountExpression(filter.mode)} AS amount,
      CAST(t.exclusiveArea AS CHAR) AS area,
      t.floor,
      ${depositExpression(filter.mode)} AS deposit
    FROM ${Prisma.raw(filter.table.table)} t
    WHERE ${exactFilterWhere(filter, window)}
    ORDER BY t.dealYear ASC, t.dealMonth ASC, t.dealDay ASC, t.id ASC
  `);
}

async function countRows(
  client: QueryClient,
  filter: NormalizedDetailFilter,
  window: DetailSnapshot<SerializedTransaction>['window'],
): Promise<number> {
  const rows = await client.$queryRaw<RawCountRow[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM ${Prisma.raw(filter.table.table)} t
    WHERE ${exactFilterWhere(filter, window)}
  `);
  return toNumber(rows[0]?.total ?? rows[0]?.count ?? 0);
}

async function getTableRows(
  client: QueryClient,
  filter: NormalizedDetailFilter,
  window: DetailSnapshot<SerializedTransaction>['window'],
  page: number,
): Promise<Array<Record<string, unknown>>> {
  const offset = (page - 1) * PAGE_SIZE;
  return client.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT ${tableSelectColumns(filter.table)}
    FROM ${Prisma.raw(filter.table.table)} t
    WHERE ${exactFilterWhere(filter, window)}
    ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC, t.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);
}

function exactFilterWhere(
  filter: NormalizedDetailFilter,
  window: DetailSnapshot<SerializedTransaction>['window'],
): Prisma.Sql {
  let depositFilter = Prisma.empty;
  if (filter.mode === 'wolse') {
    if (filter.deposit === null) {
      throw new Error('exact wolse filter requires deposit');
    }
    depositFilter = Prisma.sql`AND t.deposit = ${BigInt(filter.deposit)}`;
  }

  return Prisma.sql`
    ${baseWhere(filter.table, filter.identity, filter.mode)}
    AND ${exactDealDateFilter(window, 't')}
    AND ${areaGroupWhere(filter.area)}
    AND ${requiredValueWhere(filter.table, filter.mode)}
    ${depositFilter}
  `;
}

/** 면적 그룹 조건: ROUND(전용면적) = 그룹 키 */
function areaGroupWhere(key: string): Prisma.Sql {
  return Prisma.sql`ROUND(t.exclusiveArea) = ${Number(key)}`;
}

function baseWhere(table: TableConfig, identity: DetailIdentity, mode: DealMode): Prisma.Sql {
  return Prisma.sql`
    t.bjdCode = ${identity.bjdCode}
    AND t.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 't')}
    ${table.isSale ? Prisma.sql`AND ${saleNotCanceled('t')}` : Prisma.sql`AND t.rentType = ${mode === 'jeonse' ? '전세' : '월세'}`}
  `;
}

function requiredValueWhere(table: TableConfig, mode: DealMode): Prisma.Sql {
  if (table.isSale) {
    return Prisma.sql`t.exclusiveArea IS NOT NULL AND t.dealAmount IS NOT NULL`;
  }
  if (mode === 'wolse') {
    return Prisma.sql`t.exclusiveArea IS NOT NULL AND t.deposit IS NOT NULL AND t.monthlyRent IS NOT NULL`;
  }
  return Prisma.sql`t.exclusiveArea IS NOT NULL AND t.deposit IS NOT NULL`;
}

function amountExpression(mode: DealMode): Prisma.Sql {
  if (mode === 'sale') return Prisma.sql`t.dealAmount`;
  if (mode === 'wolse') return Prisma.sql`t.monthlyRent`;
  return Prisma.sql`t.deposit`;
}

function depositExpression(mode: DealMode): Prisma.Sql {
  return mode === 'sale' ? Prisma.sql`NULL` : Prisma.sql`t.deposit`;
}

function tableSelectColumns(table: TableConfig): Prisma.Sql {
  const aptDongColumn = table.type === 'apt-sale'
    ? Prisma.sql`t.aptDong, NULL AS houseType,`
    : table.property === 'villa'
      ? Prisma.sql`NULL AS aptDong, t.houseType,`
      : Prisma.sql`NULL AS aptDong, NULL AS houseType,`;

  if (table.isSale) {
    const registrationDate = table.type === 'apt-sale' || table.type === 'villa-sale'
      ? Prisma.sql`t.registrationDate,`
      : Prisma.sql`NULL AS registrationDate,`;
    return Prisma.sql`
      t.id, t.buildingName, t.bjdCode, t.city, t.district, t.dongName,
      t.floor, t.exclusiveArea, t.buildYear, t.jibun, t.roadName, t.lat, t.lng,
      t.dealYear, t.dealMonth, t.dealDay, t.dealAmount, t.dealType,
      t.cancelDealDay, t.cancelDealType, t.buyerType, t.sellerType,
      ${registrationDate}
      ${aptDongColumn}
      t.sourceId
    `;
  }

  return Prisma.sql`
    t.id, t.buildingName, t.bjdCode, t.city, t.district, t.dongName,
    t.floor, t.exclusiveArea, t.buildYear, t.jibun, t.roadName, t.lat, t.lng,
    t.dealYear, t.dealMonth, t.dealDay, t.rentType, t.deposit, t.monthlyRent,
    t.contractTerm, t.contractType, t.preDeposit, t.preMonthlyRent, t.useRenewalRight,
    ${aptDongColumn}
    t.sourceId
  `;
}

function latestSaleSql(table: TableConfig, identity: DetailIdentity, today: string): Prisma.Sql {
  return Prisma.sql`
    SELECT t.id, t.dealAmount, t.dealYear, t.dealMonth, t.dealDay, t.exclusiveArea, t.floor
    FROM ${Prisma.raw(table.table)} t
    WHERE t.bjdCode = ${identity.bjdCode}
      AND t.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 't')}
      AND ${saleNotCanceled('t')}
      AND t.dealAmount IS NOT NULL
      AND ${overviewDateThrough(today, 't')}
    ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
    LIMIT 1
  `;
}

function overviewSaleCountSql(
  table: TableConfig,
  identity: DetailIdentity,
  window: DetailSnapshot<SerializedTransaction>['window'],
): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*) AS count
    FROM ${Prisma.raw(table.table)} t
    WHERE t.bjdCode = ${identity.bjdCode}
      AND t.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 't')}
      AND ${saleNotCanceled('t')}
      AND t.dealAmount IS NOT NULL
      AND ${exactDealDateFilter(window, 't')}
  `;
}

function overviewAreaBoundsSql(
  saleTable: TableConfig,
  rentTable: TableConfig,
  identity: DetailIdentity,
  today: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT MIN(area) AS minArea, MAX(area) AS maxArea
    FROM (
      SELECT s.exclusiveArea AS area
      FROM ${Prisma.raw(saleTable.table)} s
      WHERE s.bjdCode = ${identity.bjdCode}
        AND s.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 's')}
        AND s.exclusiveArea IS NOT NULL
        AND ${saleNotCanceled('s')}
        AND ${validKnownDateThrough(today, 's')}
      UNION ALL
      SELECT r.exclusiveArea AS area
      FROM ${Prisma.raw(rentTable.table)} r
      WHERE r.bjdCode = ${identity.bjdCode}
        AND r.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 'r')}
        AND r.exclusiveArea IS NOT NULL
        AND r.deposit IS NOT NULL
        AND ${validKnownDateThrough(today, 'r')}
    ) u
  `;
}

function overviewAddressesSql(
  saleTable: TableConfig,
  rentTable: TableConfig,
  identity: DetailIdentity,
): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT dongName, jibun, roadName
    FROM (
      SELECT s.dongName, s.jibun, s.roadName
      FROM ${Prisma.raw(saleTable.table)} s
      WHERE s.bjdCode = ${identity.bjdCode} AND s.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 's')}
      UNION ALL
      SELECT r.dongName, r.jibun, r.roadName
      FROM ${Prisma.raw(rentTable.table)} r
      WHERE r.bjdCode = ${identity.bjdCode} AND r.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 'r')}
    ) u
    ORDER BY dongName ASC, jibun ASC, roadName ASC
  `;
}

function overviewLocationSql(
  saleTable: TableConfig,
  rentTable: TableConfig,
  identity: DetailIdentity,
): Prisma.Sql {
  return Prisma.sql`
    SELECT lat, lng
    FROM (
      SELECT s.lat, s.lng, s.dealYear, s.dealMonth, s.dealDay, s.id
      FROM ${Prisma.raw(saleTable.table)} s
      WHERE s.bjdCode = ${identity.bjdCode}
        AND s.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 's')}
        AND s.lat IS NOT NULL
        AND s.lng IS NOT NULL
      UNION ALL
      SELECT r.lat, r.lng, r.dealYear, r.dealMonth, r.dealDay, r.id
      FROM ${Prisma.raw(rentTable.table)} r
      WHERE r.bjdCode = ${identity.bjdCode}
        AND r.buildingName = ${identity.buildingName}
    ${addressWhere(identity, 'r')}
        AND r.lat IS NOT NULL
        AND r.lng IS NOT NULL
    ) u
    ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC
    LIMIT 1
  `;
}

function serializeLatestSale(row: RawLatestSaleRow | null): LatestSale | null {
  if (!row) return null;
  return {
    id: row.id,
    amount: toNumber(row.dealAmount),
    year: row.dealYear,
    month: row.dealMonth,
    day: row.dealDay,
    area: row.exclusiveArea === null ? null : formatArea(row.exclusiveArea),
    floor: row.floor,
  };
}

function formatArea(value: string | Prisma.Decimal): string {
  return new Prisma.Decimal(value).toFixed(2);
}

function formatDateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toNumber(value: string | number | bigint | Prisma.Decimal): number {
  return Number(value);
}
