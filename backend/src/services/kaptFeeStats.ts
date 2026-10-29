// K-apt 관리비 기준 월과 시군구별 ㎡당 공용관리비 중간값.
//
// 상세 페이지가 요청마다 넓은 집계를 하지 않도록 수집 끝에 한 번 계산해 KaptFeeSggMedian 에 둔다.
// - 기준 월: 관리비가 올라온 단지 수가 가장 많은 달의 95% 이상인 가장 최근 달.
//   최근 달은 일부 단지만 올라와 있다(2026-10-26 파일: 08월 20,083단지, 09월 11,370단지 → 기준 월 08월).
// - 시군구: 단지 필지의 sggCode 중 가장 작은 값(여러 시군구에 걸친 단지는 거의 없다).
// - 세대 평균 월 관리비가 정상 범위를 벗어난 단지(0원·수천만 원 같은 원본 오류)는 뺀다.
// 전국 값은 sggCode '00000' 행이다 — 상세는 이 행의 yearMonth 를 기준 월로 읽는다.

import { prisma } from '../lib/prisma.js';

/** 세대 평균 월 관리비(공용+개별+장충) 정상 범위, 원 (2026-08: 1만 원 미만 5곳, 200만 원 초과 38곳 / 20,079단지) */
export const FEE_VALID_RANGE = { min: 10_000, max: 2_000_000 } as const;
export const NATIONAL_SGG = '00000';
const BASE_MONTH_RATIO = 0.95;
const MIN_SGG_COMPLEXES = 5;

export function isValidMonthlyFee(perHousehold: number): boolean {
  return Number.isFinite(perHousehold) && perHousehold >= FEE_VALID_RANGE.min && perHousehold <= FEE_VALID_RANGE.max;
}

export function pickBaseMonth(counts: Array<{ yearMonth: string; complexes: number }>): string | null {
  if (counts.length === 0) return null;
  const threshold = Math.max(...counts.map((c) => c.complexes)) * BASE_MONTH_RATIO;
  return counts
    .filter((c) => c.complexes >= threshold)
    .map((c) => c.yearMonth)
    .sort()
    .at(-1) ?? null;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function hasFeeSggMedians(): Promise<boolean> {
  return (await prisma.kaptFeeSggMedian.count()) > 0;
}

interface BaseMonthFeeRow {
  kaptCode: string;
  commonTotal: unknown;
  individualTotal: unknown;
  ltrCharge: unknown;
  householdCount: unknown;
  managementArea: unknown;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export async function refreshFeeSggMedians(): Promise<{ baseMonth: string | null; sggCount: number }> {
  // yearMonth 인덱스만 읽는 집계 — 임시 테이블 없이 끝난다
  const counts = await prisma.$queryRaw<Array<{ yearMonth: string; complexes: bigint | number }>>`
    SELECT yearMonth, COUNT(*) AS complexes FROM KaptMaintenanceFee GROUP BY yearMonth`;
  const baseMonth = pickBaseMonth(counts.map((c) => ({ yearMonth: c.yearMonth, complexes: Number(c.complexes) })));
  if (!baseMonth) return { baseMonth: null, sggCount: 0 };

  const rows = await prisma.$queryRaw<BaseMonthFeeRow[]>`
      SELECT f.kaptCode, f.commonTotal, f.individualTotal, f.ltrCharge, k.householdCount, k.managementArea
      FROM KaptMaintenanceFee f JOIN KaptComplex k ON k.kaptCode = f.kaptCode
      WHERE f.yearMonth = ${baseMonth}`;
  const parcels = await prisma.$queryRaw<Array<{ kaptCode: string; sggCode: string }>>`
    SELECT kaptCode, MIN(sggCode) AS sggCode FROM KaptComplexParcel GROUP BY kaptCode`;
  const sggByCode = new Map(parcels.map((p) => [p.kaptCode, p.sggCode]));

  const bySgg = new Map<string, number[]>([[NATIONAL_SGG, []]]);
  for (const row of rows) {
    const households = num(row.householdCount);
    const area = num(row.managementArea);
    const common = num(row.commonTotal);
    if (!households || households <= 0 || !area || area <= 0 || common === null) continue;
    const perHousehold = (common + (num(row.individualTotal) ?? 0) + (num(row.ltrCharge) ?? 0)) / households;
    if (!isValidMonthlyFee(perHousehold)) continue;
    const perM2 = common / area;
    bySgg.get(NATIONAL_SGG)!.push(perM2);
    const sgg = sggByCode.get(row.kaptCode);
    if (!sgg) continue;
    if (!bySgg.has(sgg)) bySgg.set(sgg, []);
    bySgg.get(sgg)!.push(perM2);
  }

  const data = [...bySgg.entries()]
    .filter(([sgg, values]) => values.length >= (sgg === NATIONAL_SGG ? 1 : MIN_SGG_COMPLEXES))
    .map(([sggCode, values]) => ({
      sggCode,
      yearMonth: baseMonth,
      medianCommonPerM2: Math.round(median(values)),
      complexCount: values.length,
    }));
  await prisma.$transaction([
    prisma.kaptFeeSggMedian.deleteMany({}),
    prisma.kaptFeeSggMedian.createMany({ data }),
  ]);
  return { baseMonth, sggCount: data.filter((d) => d.sggCode !== NATIONAL_SGG).length };
}
