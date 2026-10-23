import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { makeBuildingKey } from '../lib/realEstateBuildingIdentity.js';
import { saleNotCanceled } from '../lib/realEstateDealSql.js';
import {
  PRICE_BASIS,
  areaGroupKey,
  buildAreaGroups,
  chooseDefaultAreaGroup,
  labelAreaGroups,
  monthsBefore,
  type BasisDeal,
} from '../lib/realEstatePriceBasis.js';
import { exactDealDateFilter, getDetailWindow } from './realEstateExactFilter.js';

// ─────────────────────────────────────────────
// 인근 단지 "같은 면적 최근가"
//
// 상세 overview 의 기본 면적(defaultAreaGroup)과 같은 규칙으로 현재 단지의 비교 면적(targetArea)을 정하고,
// summary 에서 고른 ≤6개 단지에 대해서만 거래 테이블을 읽어 단지마다 비교 면적(없으면 대표 면적)의
// 최근 36개월 최신 거래 1건을 붙인다. 규칙(36개월 창·최다/동률/작은 key·라벨)은 realEstatePriceBasis 재사용.
// ─────────────────────────────────────────────

export type NearbyAreaPropertyKey = 'apt' | 'villa' | 'offitel';
export type NearbyAreaRentType = 'all' | 'jeonse' | 'wolse';

export interface NearbyTargetArea {
  key: string;
  label: string;
}

export interface NearbyAreaDeal {
  /** ROUND(전용면적) */
  areaKey: string;
  /** 화면 라벨(labelAreaGroups 규칙) */
  areaLabel: string;
  /** true = 목표 면적이 그 단지에 없어 대표 면적을 씀 */
  isRepresentative: boolean;
  /** YYYY-MM-DD */
  date: string;
  floor: number | null;
  /** 매매가 또는 보증금(만원) */
  price: number;
  /** 월세(만원). 매매는 null, 전세는 0. */
  monthlyRent: number | null;
  /** 평당가 계산용 실제 전용면적 */
  exclusiveArea: number;
}

/** 거래 테이블 매칭에 필요한 인근 단지 식별 정보 */
export interface NearbyAreaIdentity {
  buildingKey?: string | null;
  buildingName: string;
  dongName: string;
  jibun?: string | null;
}

export interface NearbyAreaEnrichment {
  recentCount3y: number;
  areaDeal: NearbyAreaDeal | null;
}

const TRANSACTION_TABLE: Record<NearbyAreaPropertyKey, { sale: string; rent: string }> = {
  apt: { sale: 'AptSaleTransaction', rent: 'AptRentTransaction' },
  villa: { sale: 'VillaSaleTransaction', rent: 'VillaRentTransaction' },
  offitel: { sale: 'OffitelSaleTransaction', rent: 'OffitelRentTransaction' },
};

interface NearbyDealWindow {
  today: string;
  /** overview 와 같은 로드 시작일(포함). 36개월 판정은 이 날짜 "초과"부터다(sideStats). */
  loadFrom: string;
  /** 36개월 판정 창 시작일(포함) = loadFrom 다음 날 */
  recentFrom: string;
}

export function nearbyDealWindow(now: Date): NearbyDealWindow {
  const today = getDetailWindow(now, 6).to;
  const loadFrom = monthsBefore(today, PRICE_BASIS.defaultAreaMonths);
  const next = new Date(`${loadFrom}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { today, loadFrom, recentFrom: next.toISOString().slice(0, 10) };
}

function ymdNumber(date: string): number {
  return Number(date.replaceAll('-', ''));
}

function ymdToDate(value: number): string {
  const s = String(value).padStart(8, '0');
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function toNumber(value: number | bigint | string | Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(typeof value === 'object' ? value.toString() : value);
}

function formatArea(value: string | Prisma.Decimal): string {
  return new Prisma.Decimal(value.toString()).toFixed(2);
}

/** 같은 (면적·날짜) 거래 count 건을 BasisDeal 로 펼친다 — 그룹 판정 규칙(chooseDefaultAreaGroup·라벨)을 그대로 쓰기 위해서다. */
function expandDeals(out: BasisDeal[], area: string, date: string, count: number): void {
  for (let i = 0; i < count; i += 1) {
    out.push({ id: out.length + 1, date, amount: 0, area, floor: null, direct: false });
  }
}

// ─────────────────────────────────────────────
// targetArea — 현재 단지의 비교 면적
// ─────────────────────────────────────────────

interface RawTargetAreaRow {
  side: string;
  area: string | Prisma.Decimal;
  total: number | bigint;
  recent: number | bigint | Prisma.Decimal | null;
  latestYmd: number | bigint | Prisma.Decimal | null;
}

const DEAL_YMD_SQL = Prisma.sql`(t.dealYear * 10000 + t.dealMonth * 100 + t.dealDay)`;

function targetAreaSql(
  property: NearbyAreaPropertyKey,
  bjdCode: string,
  buildingName: string,
  dongName: string | null,
  window: NearbyDealWindow,
): Prisma.Sql {
  const tables = TRANSACTION_TABLE[property];
  const dongFilter = dongName ? Prisma.sql`AND TRIM(t.dongName) = ${dongName.trim()}` : Prisma.empty;
  const dateFilter = exactDealDateFilter({ from: window.loadFrom, to: window.today }, 't');
  const fromYmd = ymdNumber(window.loadFrom);
  const aggregate = Prisma.sql`
      CAST(t.exclusiveArea AS CHAR) AS area,
      COUNT(*) AS total,
      SUM(CASE WHEN ${DEAL_YMD_SQL} > ${fromYmd} THEN 1 ELSE 0 END) AS recent,
      MAX(${DEAL_YMD_SQL}) AS latestYmd`;
  // overview(loadBasisDeals 매매·전세)와 같은 거래 집합을 면적별로 집계한다. 1회 왕복.
  return Prisma.sql`
    SELECT 'sale' AS side, ${aggregate}
    FROM ${Prisma.raw(tables.sale)} t
    WHERE t.bjdCode = ${bjdCode}
      AND t.buildingName = ${buildingName}
      ${dongFilter}
      AND ${saleNotCanceled('t')}
      AND t.exclusiveArea IS NOT NULL AND t.dealAmount IS NOT NULL
      AND ${dateFilter}
    GROUP BY t.exclusiveArea
    UNION ALL
    SELECT 'jeonse' AS side, ${aggregate}
    FROM ${Prisma.raw(tables.rent)} t
    WHERE t.bjdCode = ${bjdCode}
      AND t.buildingName = ${buildingName}
      ${dongFilter}
      AND t.rentType = '전세'
      AND t.exclusiveArea IS NOT NULL AND t.deposit IS NOT NULL
      AND ${dateFilter}
    GROUP BY t.exclusiveArea
  `;
}

/**
 * 집계 행 → overview 와 같은 BasisDeal 집합(면적·날짜만 의미 있음).
 * 로드 창 [loadFrom, today] 중 36개월 판정에 드는 거래(> loadFrom)는 그 면적의 최신 날짜로,
 * 나머지(정확히 loadFrom 당일)는 loadFrom 으로 펼친다 — 그룹별 거래 수·최근 거래일·라벨 빈도가 원본과 같다.
 */
export function targetDealsFromRows(
  rows: RawTargetAreaRow[],
  window: NearbyDealWindow,
): { sale: BasisDeal[]; jeonse: BasisDeal[] } {
  const sale: BasisDeal[] = [];
  const jeonse: BasisDeal[] = [];
  for (const row of rows) {
    const out = row.side === 'sale' ? sale : jeonse;
    const area = formatArea(row.area);
    const total = toNumber(row.total);
    const recent = toNumber(row.recent);
    const latest = row.latestYmd === null ? window.loadFrom : ymdToDate(toNumber(row.latestYmd));
    expandDeals(out, area, latest, recent);
    expandDeals(out, area, window.loadFrom, total - recent);
  }
  return { sale, jeonse };
}

export async function loadNearbyTargetArea(params: {
  property: NearbyAreaPropertyKey;
  prefer: 'sale' | 'jeonse';
  bjdCode: string;
  buildingName: string;
  dongName: string | null;
  areaKey: string | null;
  now: Date;
}): Promise<NearbyTargetArea | null> {
  const window = nearbyDealWindow(params.now);
  const rows = await prisma.$queryRaw<RawTargetAreaRow[]>(
    targetAreaSql(params.property, params.bjdCode, params.buildingName, params.dongName, window),
  );
  const { sale, jeonse } = targetDealsFromRows(rows, window);
  const groups = buildAreaGroups(sale, jeonse, window.today);
  const key = params.areaKey ?? chooseDefaultAreaGroup(groups, sale, jeonse, params.prefer, window.today);
  if (key === null) return null;
  return { key, label: groups.find((group) => group.key === key)?.label ?? key };
}

// ─────────────────────────────────────────────
// 인근 단지별 최근 36개월 면적 거래
// ─────────────────────────────────────────────

interface RawNearbyAreaRow {
  id: number;
  buildingName: string;
  dongName: string | null;
  jibun: string | null;
  area: string | Prisma.Decimal;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  floor: number | null;
  price: number | bigint | Prisma.Decimal | null;
  monthlyRent: number | bigint | Prisma.Decimal | null;
  cnt: number | bigint;
}

function nearbyAreaDealsSql(
  property: NearbyAreaPropertyKey,
  mode: 'sale' | 'rent',
  rentType: NearbyAreaRentType,
  bjdCode: string,
  buildingNames: string[],
  window: NearbyDealWindow,
): Prisma.Sql {
  const isSale = mode === 'sale';
  const table = isSale ? TRANSACTION_TABLE[property].sale : TRANSACTION_TABLE[property].rent;
  const modeFilter = isSale
    ? Prisma.sql`AND ${saleNotCanceled('t')} AND t.dealAmount IS NOT NULL`
    : Prisma.sql`AND t.deposit IS NOT NULL ${
      rentType === 'jeonse' ? Prisma.sql`AND t.rentType = '전세'`
        : rentType === 'wolse' ? Prisma.sql`AND t.rentType = '월세'`
          : Prisma.empty
    }`;
  const partition = Prisma.sql`PARTITION BY t.buildingName, TRIM(t.dongName), COALESCE(TRIM(t.jibun), ''), t.exclusiveArea`;
  // bjdCode + buildingName IN (≤6) + 연·월 범위 → [buildingName, bjdCode, dealYear, dealMonth, dealDay]
  // 또는 [bjdCode, buildingName] 인덱스 범위 스캔. 단지·정확 면적별 최신 1건과 건수만 돌려준다.
  return Prisma.sql`
    SELECT x.id, x.buildingName, x.dongName, x.jibun, x.area, x.dealYear, x.dealMonth, x.dealDay,
           x.floor, x.price, x.monthlyRent, x.cnt
    FROM (
      SELECT
        t.id,
        t.buildingName,
        TRIM(t.dongName) AS dongName,
        COALESCE(TRIM(t.jibun), '') AS jibun,
        CAST(t.exclusiveArea AS CHAR) AS area,
        t.dealYear,
        t.dealMonth,
        t.dealDay,
        t.floor,
        ${isSale ? Prisma.sql`t.dealAmount` : Prisma.sql`t.deposit`} AS price,
        ${isSale ? Prisma.sql`NULL` : Prisma.sql`t.monthlyRent`} AS monthlyRent,
        COUNT(*) OVER (${partition}) AS cnt,
        ROW_NUMBER() OVER (${partition} ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC, t.id DESC) AS rn
      FROM ${Prisma.raw(table)} t
      WHERE t.bjdCode = ${bjdCode}
        AND t.buildingName IN (${Prisma.join(buildingNames)})
        AND t.exclusiveArea IS NOT NULL
        ${modeFilter}
        AND ${exactDealDateFilter({ from: window.recentFrom, to: window.today }, 't')}
    ) x
    WHERE x.rn = 1
  `;
}

interface AreaRow {
  id: number;
  area: string;
  date: string;
  floor: number | null;
  price: number;
  monthlyRent: number | null;
  count: number;
}

/** 거래 행이 이 인근 단지의 것인가: V2 summary(buildingKey)는 키 일치, 그 외는 이름+동(+지번). */
function matchesIdentity(
  property: NearbyAreaPropertyKey,
  bjdCode: string,
  identity: NearbyAreaIdentity,
  row: RawNearbyAreaRow,
): boolean {
  if (row.buildingName !== identity.buildingName) return false;
  const dong = row.dongName?.trim() ?? '';
  const jibun = row.jibun?.trim() ?? '';
  if (identity.buildingKey) {
    return makeBuildingKey({ propertyType: property, bjdCode, buildingName: row.buildingName, dongName: dong, jibun })
      === identity.buildingKey;
  }
  if (dong !== identity.dongName.trim()) return false;
  if (identity.jibun === undefined || identity.jibun === null) return true;
  return jibun === identity.jibun.trim();
}

const byLatest = (a: AreaRow, b: AreaRow): number =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;

/**
 * 한 단지의 (정확 면적별 최신 1건 + 건수) 행 → recentCount3y·areaDeal.
 * targetKey 가 있으면 그 그룹, 없거나 그 단지에 없으면 대표 면적(36개월 최다 → 동률 최근 → 작은 key).
 */
export function pickNearbyAreaDeal(
  rows: AreaRow[],
  targetKey: string | null,
  markRepresentative: boolean,
  window: NearbyDealWindow,
): NearbyAreaEnrichment {
  const inWindow = rows.filter((row) => row.date >= window.recentFrom && row.date <= window.today && row.count > 0);
  if (inWindow.length === 0) return { recentCount3y: 0, areaDeal: null };

  const deals: BasisDeal[] = [];
  const areasByKey = new Map<string, string[]>();
  const rowsByKey = new Map<string, AreaRow[]>();
  for (const row of inWindow) {
    const key = areaGroupKey(row.area);
    expandDeals(deals, row.area, row.date, row.count);
    const areas = areasByKey.get(key) ?? [];
    for (let i = 0; i < row.count; i += 1) areas.push(row.area);
    areasByKey.set(key, areas);
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), row]);
  }
  const recentCount3y = inWindow.reduce((sum, row) => sum + row.count, 0);
  const labels = labelAreaGroups(areasByKey);

  let key = targetKey !== null && rowsByKey.has(targetKey) ? targetKey : null;
  const isRepresentative = key === null && targetKey !== null && markRepresentative;
  if (key === null) {
    const groups = buildAreaGroups(deals, [], window.today);
    key = chooseDefaultAreaGroup(groups, deals, [], 'sale', window.today);
  }
  const best = key === null ? undefined : [...(rowsByKey.get(key) ?? [])].sort(byLatest)[0];
  if (!key || !best) return { recentCount3y, areaDeal: null };

  return {
    recentCount3y,
    areaDeal: {
      areaKey: key,
      areaLabel: labels.get(key) ?? key,
      isRepresentative,
      date: best.date,
      floor: best.floor,
      price: best.price,
      monthlyRent: best.monthlyRent,
      exclusiveArea: Number(best.area),
    },
  };
}

/**
 * 인근 단지 목록에 recentCount3y·areaDeal 을 붙인다. 유형당 거래 테이블 쿼리 1회.
 * sameProperty=true(현재 페이지와 같은 유형)일 때만 targetKey 로 비교하고 (대표 면적) 표시를 켠다.
 */
export async function attachNearbyAreaDeals<T extends NearbyAreaIdentity>(params: {
  property: NearbyAreaPropertyKey;
  mode: 'sale' | 'rent';
  rentType: NearbyAreaRentType;
  bjdCode: string;
  items: T[];
  targetKey: string | null;
  sameProperty: boolean;
  now: Date;
}): Promise<Array<T & NearbyAreaEnrichment>> {
  if (params.items.length === 0) return [];
  const window = nearbyDealWindow(params.now);
  const names = [...new Set(params.items.map((item) => item.buildingName))];
  const rows = await prisma.$queryRaw<RawNearbyAreaRow[]>(
    nearbyAreaDealsSql(params.property, params.mode, params.rentType, params.bjdCode, names, window),
  );
  const targetKey = params.sameProperty ? params.targetKey : null;
  return params.items.map((item) => {
    const own = rows
      .filter((row) => matchesIdentity(params.property, params.bjdCode, item, row))
      .map((row): AreaRow => ({
        id: Number(row.id),
        area: formatArea(row.area),
        date: `${row.dealYear}-${String(row.dealMonth).padStart(2, '0')}-${String(row.dealDay).padStart(2, '0')}`,
        floor: row.floor ?? null,
        price: toNumber(row.price),
        monthlyRent: params.mode === 'sale' || row.monthlyRent === null ? null : toNumber(row.monthlyRent),
        count: toNumber(row.cnt),
      }));
    return { ...item, ...pickNearbyAreaDeal(own, targetKey, params.sameProperty, window) };
  });
}
