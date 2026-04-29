// 부동산 거래 변동률 v1 (apt) — 동·평형 단위 trimmed mean + 변동률 계산.
// 단위 테스트가 가능하도록 in-memory 집계 함수(aggregateTransactions)를 분리해 두었음.

import { prisma } from '../lib/prisma.js';
import {
  classifyAreaBucket,
  trimmedMean,
  calcChangeRatio,
  formatYearMonth,
  shiftMonth,
  isSampleSizeSufficient,
} from '../lib/realEstateTrendHelpers.js';

export type TxType = 'sale' | 'rent';

export interface TxInput {
  dongName: string;
  dealYear: number;
  dealMonth: number;
  exclusiveArea: number | null;
  dealAmount: bigint;
}

export interface TrendRow {
  city: string;
  district: string;
  dong: string;
  areaBucket: string;
  txType: TxType;
  yearMonth: string;
  avgPrice: bigint;
  txCount: number;
  prevMonthAvg: bigint | null;
  prev3MonthAvg: bigint | null;
  prevYearAvg: bigint | null;
  monthOverMonth: number | null;
  qtrOverQtr: number | null;
  yearOverYear: number | null;
}

function makeKey(dong: string, yearMonth: string, areaBucket: string): string {
  return `${dong}|${yearMonth}|${areaBucket}`;
}

/**
 * 한 city·district의 트랜잭션 배열 → 변동률 행 배열.
 *
 * - dong · yearMonth · areaBucket으로 그룹화
 * - 5건 미만 그룹은 결과에서 제외 (UI hide)
 * - trimmedMean(10%)로 이상치 제거 후 평균
 * - prevMonth/prev3Month/prevYear는 같은 dong·areaBucket 내에서 lookup
 */
export function aggregateTransactions(
  city: string,
  district: string,
  txType: TxType,
  txs: TxInput[]
): TrendRow[] {
  // 1) 그룹화
  const groups = new Map<
    string,
    { dong: string; yearMonth: string; areaBucket: string; prices: number[] }
  >();
  for (const tx of txs) {
    const yearMonth = formatYearMonth(tx.dealYear, tx.dealMonth);
    const areaBucket = classifyAreaBucket(tx.exclusiveArea);
    const key = makeKey(tx.dongName, yearMonth, areaBucket);
    let group = groups.get(key);
    if (!group) {
      group = { dong: tx.dongName, yearMonth, areaBucket, prices: [] };
      groups.set(key, group);
    }
    group.prices.push(Number(tx.dealAmount));
  }

  // 2) 평균 계산 (5건 미만 hide, trimmed mean)
  const rowByKey = new Map<string, TrendRow>();
  for (const [key, g] of groups) {
    if (!isSampleSizeSufficient(g.prices.length)) continue;
    const avg = trimmedMean(g.prices, 0.1);
    if (avg === null) continue;
    rowByKey.set(key, {
      city,
      district,
      dong: g.dong,
      areaBucket: g.areaBucket,
      txType,
      yearMonth: g.yearMonth,
      avgPrice: BigInt(Math.round(avg)),
      txCount: g.prices.length,
      prevMonthAvg: null,
      prev3MonthAvg: null,
      prevYearAvg: null,
      monthOverMonth: null,
      qtrOverQtr: null,
      yearOverYear: null,
    });
  }

  // 3) 변동률 attach (같은 dong·areaBucket의 과거 yearMonth lookup)
  for (const row of rowByKey.values()) {
    const k1 = makeKey(row.dong, shiftMonth(row.yearMonth, -1), row.areaBucket);
    const k3 = makeKey(row.dong, shiftMonth(row.yearMonth, -3), row.areaBucket);
    const k12 = makeKey(row.dong, shiftMonth(row.yearMonth, -12), row.areaBucket);
    const prev1 = rowByKey.get(k1)?.avgPrice ?? null;
    const prev3 = rowByKey.get(k3)?.avgPrice ?? null;
    const prev12 = rowByKey.get(k12)?.avgPrice ?? null;
    row.prevMonthAvg = prev1;
    row.prev3MonthAvg = prev3;
    row.prevYearAvg = prev12;
    row.monthOverMonth = calcChangeRatio(
      Number(row.avgPrice),
      prev1 === null ? null : Number(prev1)
    );
    row.qtrOverQtr = calcChangeRatio(
      Number(row.avgPrice),
      prev3 === null ? null : Number(prev3)
    );
    row.yearOverYear = calcChangeRatio(
      Number(row.avgPrice),
      prev12 === null ? null : Number(prev12)
    );
  }

  return [...rowByKey.values()];
}

// ── 조회 API ──────────────────────────────────────────────────────────────

export interface TrendQuery {
  propertyType?: string;
  city: string;
  district: string;
  dong?: string;
  areaBucket?: string;
  txType?: TxType;
  yearMonth?: string;
}

export interface TrendResultItem {
  propertyType: string;
  city: string;
  district: string;
  dong: string;
  areaBucket: string;
  txType: string;
  yearMonth: string;
  avgPrice: number;
  txCount: number;
  prevMonthAvg: number | null;
  prev3MonthAvg: number | null;
  prevYearAvg: number | null;
  monthOverMonth: number | null;
  qtrOverQtr: number | null;
  yearOverYear: number | null;
}

/**
 * 변동률 조회 (UI용). 응답에서 BigInt → Number 직렬화.
 */
export async function getTrend(query: TrendQuery): Promise<{ items: TrendResultItem[] }> {
  const where: {
    propertyType: string;
    city: string;
    district: string;
    dong?: string;
    areaBucket?: string;
    txType?: TxType;
    yearMonth?: string;
  } = {
    propertyType: query.propertyType ?? 'apt',
    city: query.city,
    district: query.district,
  };
  if (query.dong) where.dong = query.dong;
  if (query.areaBucket) where.areaBucket = query.areaBucket;
  if (query.txType) where.txType = query.txType;
  if (query.yearMonth) where.yearMonth = query.yearMonth;

  const items = await prisma.realEstateTrend.findMany({
    where,
    orderBy: [
      { yearMonth: 'desc' },
      { dong: 'asc' },
      { areaBucket: 'asc' },
    ],
  });

  return {
    items: items.map((i) => ({
      propertyType: i.propertyType,
      city: i.city,
      district: i.district,
      dong: i.dong,
      areaBucket: i.areaBucket,
      txType: i.txType,
      yearMonth: i.yearMonth,
      avgPrice: Number(i.avgPrice),
      txCount: i.txCount,
      prevMonthAvg: i.prevMonthAvg === null ? null : Number(i.prevMonthAvg),
      prev3MonthAvg: i.prev3MonthAvg === null ? null : Number(i.prev3MonthAvg),
      prevYearAvg: i.prevYearAvg === null ? null : Number(i.prevYearAvg),
      monthOverMonth: i.monthOverMonth,
      qtrOverQtr: i.qtrOverQtr,
      yearOverYear: i.yearOverYear,
    })),
  };
}

/**
 * upsert 헬퍼 — 배치 스크립트가 사용. 500건씩 트랜잭션으로 묶어 buffer pool 압박 회피.
 * (메모리 [MySQL Zombie 사고] 노트 — 긴 트랜잭션 + per-item upsert 회피)
 */
export async function upsertTrendRows(rows: TrendRow[], propertyType: string = 'apt'): Promise<void> {
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // interactive transaction (timeout 옵션 사용 가능)
    await prisma.$transaction(
      async (tx) => {
        for (const r of batch) {
          await tx.realEstateTrend.upsert({
            where: {
              propertyType_city_district_dong_areaBucket_txType_yearMonth: {
                propertyType,
                city: r.city,
                district: r.district,
                dong: r.dong,
                areaBucket: r.areaBucket,
                txType: r.txType,
                yearMonth: r.yearMonth,
              },
            },
            update: {
              avgPrice: r.avgPrice,
              txCount: r.txCount,
              prevMonthAvg: r.prevMonthAvg,
              prev3MonthAvg: r.prev3MonthAvg,
              prevYearAvg: r.prevYearAvg,
              monthOverMonth: r.monthOverMonth,
              qtrOverQtr: r.qtrOverQtr,
              yearOverYear: r.yearOverYear,
              computedAt: new Date(),
            },
            create: {
              propertyType,
              city: r.city,
              district: r.district,
              dong: r.dong,
              areaBucket: r.areaBucket,
              txType: r.txType,
              yearMonth: r.yearMonth,
              avgPrice: r.avgPrice,
              txCount: r.txCount,
              prevMonthAvg: r.prevMonthAvg,
              prev3MonthAvg: r.prev3MonthAvg,
              prevYearAvg: r.prevYearAvg,
              monthOverMonth: r.monthOverMonth,
              qtrOverQtr: r.qtrOverQtr,
              yearOverYear: r.yearOverYear,
            },
          });
        }
      },
      { timeout: 30000 }
    );
  }
}
