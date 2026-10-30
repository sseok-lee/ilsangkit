import type { Prisma } from '@prisma/client';
import {
  MIN_PRICE_SAMPLE,
  MIN_RISING_VOLUME,
  PREV_FROM_DAYS,
  PREV_TO_DAYS,
  RECENT_FROM_DAYS,
  RECENT_TO_DAYS,
  TOP_DEALS_LIMIT,
} from '../constants/regionMarket.js';
import { prisma } from '../lib/prisma.js';
import { makeBuildingKey } from '../lib/realEstateBuildingIdentity.js';
import { runSync, type SyncStats } from './baseSyncService.js';
import { kstToday } from './busStopTagoClient.js';
import { buildRegionFilter } from './cityMapping.js';
import { listMarketRegionKeys, type MarketRegionKey } from './marketRegionResolver.js';
import { attachRealEstateCanonicalPaths } from './realEstateUrlRegistry.js';

export interface DateRange {
  from: string;
  to: string;
}

export interface RegionMarketTopDeal {
  buildingName: string;
  bjdCode: string;
  dongName: string;
  jibun: string | null;
  area: number | null;
  amount: number;
  date: string;
  canonicalPath?: string;
}

export type RegionMarketSummaryRow = Omit<Prisma.RegionMarketSummaryCreateInput, 'topDeals'> & {
  topDeals: RegionMarketTopDeal[];
};

const PYEONG_FACTOR = 3.3058;
/** 평당가 히스토그램 버킷(만원). 중간값은 이 단위로 반올림된다(전국 로컬 기준 정확값 41만 행 → 행 수 절감). */
const PP_BUCKET = 10;
const DATE_EXPR = "STR_TO_DATE(CONCAT(dealYear, '-', dealMonth, '-', dealDay), '%Y-%c-%e')";

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function regionMarketWindows(todayKst: string): {
  last12: DateRange;
  prev12: DateRange;
  recent: DateRange;
  prev: DateRange;
} {
  return {
    last12: { from: shiftDay(todayKst, -365), to: shiftDay(todayKst, -1) },
    prev12: { from: shiftDay(todayKst, -730), to: shiftDay(todayKst, -366) },
    recent: { from: shiftDay(todayKst, -RECENT_FROM_DAYS), to: shiftDay(todayKst, -RECENT_TO_DAYS) },
    prev: { from: shiftDay(todayKst, -PREV_FROM_DAYS), to: shiftDay(todayKst, -PREV_TO_DAYS) },
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function yoyPct(cur: number | null, prev: number | null, prevCount: number): number | null {
  if (cur === null || prev === null || prev === 0 || prevCount < MIN_PRICE_SAMPLE) return null;
  return Math.round((cur / prev - 1) * 1000) / 10;
}

export function isRising(volRecent: number, volPrev: number): boolean {
  return volRecent >= MIN_RISING_VOLUME && volPrev >= 1 && volRecent > volPrev;
}

/** 평당가 히스토그램(값→건수)에서 중간값. median() 과 같은 규칙(짝수면 가운데 둘 평균 반올림). */
export function histogramMedian(hist: Map<number, number>): number | null {
  const entries = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0) return null;
  const at = (index: number): number => {
    let seen = 0;
    for (const [value, count] of entries) {
      seen += count;
      if (index < seen) return value;
    }
    return entries[entries.length - 1][0];
  };
  const mid = Math.floor(total / 2);
  return total % 2 === 1 ? at(mid) : Math.round((at(mid - 1) + at(mid)) / 2);
}

const BASE_CLAUSES = [
  'dealDay IS NOT NULL',
  "(cancelDealDay IS NULL OR cancelDealDay = '')",
  "(cancelDealType IS NULL OR cancelDealType = '')",
  "(dealType IS NULL OR dealType <> '직거래')",
  'exclusiveArea > 0',
  'dealAmount > 0',
];

function whereSql(extra: string[]): string {
  return [...BASE_CLAUSES, ...extra].join(' AND ');
}

// 인덱스(dealYear, dealMonth)를 타도록 컬럼 그대로 비교하는 월 단위 경계. 정확한 날짜 경계는 DATE_RANGE 가 다듬는다.
const YEAR_RANGE =
  '(dealYear > ? OR (dealYear = ? AND dealMonth >= ?)) AND (dealYear < ? OR (dealYear = ? AND dealMonth <= ?))';
const DATE_RANGE = `${DATE_EXPR} BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')`;

/** YEAR_RANGE 파라미터(6개) — from/to 날짜의 연·월. */
function yearRangeParams(from: string, to: string): number[] {
  const fy = Number(from.slice(0, 4));
  const fm = Number(from.slice(5, 7));
  const ty = Number(to.slice(0, 4));
  const tm = Number(to.slice(5, 7));
  return [fy, fy, fm, ty, ty, tm];
}

interface HistRow { city: string; district: string; cur: number | bigint; pp: number | bigint | string; cnt: number | bigint }
interface VolRow { city: string; district: string; volRecent: number | bigint; volPrev: number | bigint }
interface TopRow {
  city: string;
  district: string;
  buildingName: string;
  bjdCode: string;
  dongName: string;
  jibun: string | null;
  area: string | number | null;
  amount: number | bigint;
  date: string | Date;
  transactionId: number;
}

interface Agg {
  cur: Map<number, number>;
  prev: Map<number, number>;
  volRecent: number;
  volPrev: number;
  tops: TopRow[];
}

const emptyAgg = (): Agg => ({ cur: new Map(), prev: new Map(), volRecent: 0, volPrev: 0, tops: [] });

function addHist(target: Map<number, number>, source: Map<number, number>): void {
  for (const [value, count] of source) target.set(value, (target.get(value) ?? 0) + count);
}

function matches(key: MarketRegionKey, city: string, district: string, variants: Map<string, Set<string>>): boolean {
  if (key.scope === 'nation') return true;
  if (!variants.get(key.queryCity)?.has(city)) return false;
  return key.scope === 'city' ? key.districtLimit.includes(district) : district === key.queryDistrict;
}

function dateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/**
 * 전 지역 요약을 계산한다. DB 는 (city, district) 단위 GROUP BY 3번(평당가 히스토그램·구간 거래수·최고가 TOP N)만 읽고,
 * 전국/시·도/구 행은 앱에서 같은 규칙(홈 지역 키)으로 합쳐 만든다. 평당가는 정수 히스토그램이라 행 수가 작다.
 */
export async function computeRegionMarketSummaries(todayKst: string): Promise<RegionMarketSummaryRow[]> {
  const w = regionMarketWindows(todayKst);
  const keys = await listMarketRegionKeys();
  const ppExpr = `ROUND(dealAmount / exclusiveArea * ${PYEONG_FACTOR} / ${PP_BUCKET}) * ${PP_BUCKET}`;

  // 무거운 3쿼리는 DB 부하를 위해 직렬로 실행한다.
  const histRows = await prisma.$queryRawUnsafe<HistRow[]>(
    `SELECT city, district, CASE WHEN ${DATE_EXPR} >= STR_TO_DATE(?, '%Y-%m-%d') THEN 1 ELSE 0 END AS cur,
            ${ppExpr} AS pp, COUNT(*) AS cnt
     FROM AptSaleTransaction
     WHERE ${whereSql([YEAR_RANGE, DATE_RANGE])}
     GROUP BY city, district, cur, pp`,
    w.last12.from, ...yearRangeParams(w.prev12.from, w.last12.to), w.prev12.from, w.last12.to,
  );
  const volRows = await prisma.$queryRawUnsafe<VolRow[]>(
    `SELECT city, district,
            SUM(CASE WHEN ${DATE_EXPR} >= STR_TO_DATE(?, '%Y-%m-%d') THEN 1 ELSE 0 END) AS volRecent,
            SUM(CASE WHEN ${DATE_EXPR} < STR_TO_DATE(?, '%Y-%m-%d') THEN 1 ELSE 0 END) AS volPrev
     FROM AptSaleTransaction
     WHERE ${whereSql([YEAR_RANGE, DATE_RANGE])}
     GROUP BY city, district`,
    w.recent.from, w.recent.from, ...yearRangeParams(w.prev.from, w.recent.to), w.prev.from, w.recent.to,
  );
  // 순위는 숫자 키만으로 매긴다. 단지(makeBuildingKey 와 같은 bjdCode·buildingName·dongName·jibun)당 최고 거래 1건만 남긴 뒤
  // (city, district) 안에서 TOP N 을 고르고, 넓은 컬럼은 id 로 따로 가져온다.
  // 문자열 컬럼으로 창 정렬하면 정렬 키가 커서 /mysql-tmp(2GB)를 채운다(10/30 운영 실측) → 64비트 해시로 정렬한다.
  const hash = (cols: string): string => `CAST(CONV(LEFT(MD5(CONCAT_WS(0x00, ${cols})), 16), 16, 10) AS UNSIGNED)`;
  const rankedIds = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY regionHash ORDER BY dealAmount DESC, id DESC) AS rn
       FROM (
         SELECT id, dealAmount, regionHash,
                ROW_NUMBER() OVER (PARTITION BY complexHash ORDER BY dealAmount DESC, id DESC) AS crn
         FROM (
           SELECT id, dealAmount,
                  ${hash('city, district')} AS regionHash,
                  ${hash("city, district, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')")} AS complexHash
           FROM AptSaleTransaction
           WHERE ${whereSql([YEAR_RANGE, DATE_RANGE])}
         ) keyed
       ) per_complex
       WHERE crn = 1
     ) ranked
     WHERE rn <= ${TOP_DEALS_LIMIT}`,
    ...yearRangeParams(w.last12.from, w.last12.to), w.last12.from, w.last12.to,
  );
  const topRows: TopRow[] = [];
  for (let i = 0; i < rankedIds.length; i += 500) {
    const ids = rankedIds.slice(i, i + 500).map((r) => Number(r.id));
    const rows = await prisma.$queryRawUnsafe<TopRow[]>(
      `SELECT city, district, buildingName, bjdCode, dongName, jibun,
              DATE_FORMAT(${DATE_EXPR}, '%Y-%m-%d') AS date, dealAmount AS amount,
              CAST(exclusiveArea AS CHAR) AS area, id AS transactionId
       FROM AptSaleTransaction
       WHERE id IN (${ids.map(() => '?').join(', ')}) AND ${BASE_CLAUSES.join(' AND ')}`,
      ...ids,
    );
    topRows.push(...rows);
  }

  // (city, district) 원본 집계
  const base = new Map<string, { city: string; district: string; agg: Agg }>();
  const slot = (city: string, district: string): Agg => {
    const id = `${city}\u0000${district}`;
    let entry = base.get(id);
    if (!entry) {
      entry = { city, district, agg: emptyAgg() };
      base.set(id, entry);
    }
    return entry.agg;
  };
  for (const r of histRows) {
    const hist = Number(r.cur) === 1 ? slot(r.city, r.district).cur : slot(r.city, r.district).prev;
    const pp = Number(r.pp);
    hist.set(pp, (hist.get(pp) ?? 0) + Number(r.cnt));
  }
  for (const r of volRows) {
    const agg = slot(r.city, r.district);
    agg.volRecent += Number(r.volRecent);
    agg.volPrev += Number(r.volPrev);
  }
  for (const r of topRows) slot(r.city, r.district).tops.push(r);

  const variants = new Map<string, Set<string>>();
  for (const key of keys) {
    if (key.scope !== 'nation' && !variants.has(key.queryCity)) {
      const city = buildRegionFilter(key.queryCity).city;
      const list = typeof city === 'object' && city !== null && 'in' in city ? (city as { in: string[] }).in : [key.queryCity];
      variants.set(key.queryCity, new Set(list));
    }
  }

  const aggs = keys.map((key) => {
    const agg = emptyAgg();
    for (const { city, district, agg: part } of base.values()) {
      if (!matches(key, city, district, variants)) continue;
      addHist(agg.cur, part.cur);
      addHist(agg.prev, part.prev);
      agg.volRecent += part.volRecent;
      agg.volPrev += part.volPrev;
      agg.tops.push(...part.tops);
    }
    agg.tops.sort((a, b) => Number(b.amount) - Number(a.amount) || b.transactionId - a.transactionId);
    // 시·도 표기 변형(서울/서울특별시)이 합쳐지면 같은 단지가 둘일 수 있어 단지당 최고가 1건만 남긴다.
    const seen = new Set<string>();
    agg.tops = agg.tops
      .filter((t) => {
        const id = [t.bjdCode, t.buildingName, (t.dongName ?? '').trim(), (t.jibun ?? '').trim()].join('\u0000');
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, TOP_DEALS_LIMIT);
    return agg;
  });

  // canonicalPath 는 모든 후보를 한 번에 붙인다(키 간 같은 행 공유).
  const uniqueTops = new Map<number, TopRow>();
  for (const agg of aggs) for (const t of agg.tops) uniqueTops.set(t.transactionId, t);
  const candidates = [...uniqueTops.values()].map((t) => ({
    transactionId: t.transactionId,
    bjdCode: t.bjdCode,
    buildingName: t.buildingName,
    dongName: t.dongName,
    jibun: t.jibun,
    buildingKey: makeBuildingKey({
      propertyType: 'apt',
      bjdCode: t.bjdCode,
      buildingName: t.buildingName,
      dongName: t.dongName ?? '',
      jibun: t.jibun,
    }),
  }));
  const withPaths = await attachRealEstateCanonicalPaths(candidates, 'apt-sale');
  const pathById = new Map(withPaths.map((c) => [c.transactionId, c.canonicalPath]));

  const computedAt = new Date();
  return keys.map((key, i) => {
    const agg = aggs[i];
    const count = (h: Map<number, number>): number => [...h.values()].reduce((s, c) => s + c, 0);
    return {
      scope: key.scope,
      citySlug: key.citySlug,
      districtSlug: key.districtSlug,
      label: key.label,
      ppMedian12m: histogramMedian(agg.cur),
      ppMedianPrev12m: histogramMedian(agg.prev),
      dealCount12m: count(agg.cur),
      dealCountPrev12m: count(agg.prev),
      topDeals: agg.tops.map((t) => ({
        buildingName: t.buildingName,
        bjdCode: t.bjdCode,
        dongName: t.dongName,
        jibun: t.jibun,
        area: t.area === null ? null : Number(t.area),
        amount: Number(t.amount),
        date: dateString(t.date),
        canonicalPath: pathById.get(t.transactionId),
      })),
      volRecent: agg.volRecent,
      volPrev: agg.volPrev,
      recentFrom: w.recent.from,
      recentTo: w.recent.to,
      prevFrom: w.prev.from,
      prevTo: w.prev.to,
      computedAt,
    };
  });
}

/**
 * 요약을 새로 계산해 통째로 교체한다. 계산이 전부 끝난 뒤에만(그리고 1행 이상일 때만)
 * 한 트랜잭션에서 delete→create 하므로, 중간 실패 시 이전 행이 그대로 남는다.
 */
export async function refreshRegionMarketSummaries(todayKst: string = kstToday()): Promise<SyncStats> {
  return runSync('region-market', async (stats) => {
    const rows = await computeRegionMarketSummaries(todayKst);
    // 전국 키는 항상 존재하므로 행 수가 아니라 전국 12개월 거래 수로 빈 집계를 판정한다.
    const nation = rows.find((row) => row.scope === 'nation');
    if (!nation || nation.dealCount12m === 0) {
      throw new Error('지역 시세 요약 집계가 비어 있습니다(전국 거래 0건) — 기존 요약을 유지합니다');
    }
    stats.totalRecords = rows.length;
    await prisma.$transaction([
      prisma.regionMarketSummary.deleteMany(),
      prisma.regionMarketSummary.createMany({
        data: rows as unknown as Prisma.RegionMarketSummaryCreateManyInput[],
      }),
    ]);
  });
}
