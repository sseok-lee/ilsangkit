// 상세 개요용 K-apt 관리비 조회. 단지코드 하나에 대해 인덱스 조회만 한다
// (기준 월 1행 · 단지 1행 · 시군구 중간값 1행 · 관리비 최근 24개월).
// 24개월: 겨울(12·1·2월)은 기준 월보다 1년 넘게 앞설 수 있다(기준 월이 1월이면 직전 겨울이 13~11개월 전).

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { MaintenanceFeeSummary } from '../types/housingRedesign.js';
import { KAPT_FEE_COLUMNS } from './kaptFeeParser.js';
import { NATIONAL_SGG } from './kaptFeeStats.js';
import { summarizeMaintenanceFee, type FeeMonthRow } from './kaptFeeSummary.js';

const HISTORY_MONTHS = 24;
const FEE_SELECT = Prisma.raw(['yearMonth', ...KAPT_FEE_COLUMNS.map(([, column]) => column)].join(', '));

interface ComplexFeeRow {
  householdCount: unknown;
  managementArea: unknown;
  raw: unknown;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

function shiftMonth(yearMonth: string, delta: number): string {
  const index = Number(yearMonth.slice(0, 4)) * 12 + Number(yearMonth.slice(4, 6)) - 1 + delta;
  return `${Math.floor(index / 12)}${String((index % 12) + 1).padStart(2, '0')}`;
}

function officeFrom(raw: unknown): MaintenanceFeeSummary['office'] {
  const record = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
  const text = (key: string): string | null => {
    const value = String(record?.[key] ?? '').trim();
    return value === '' ? null : value;
  };
  return { phone: text('관리사무소 연락처'), address: text('관리사무소 주소') };
}

export async function loadMaintenanceFee(kaptCode: string): Promise<MaintenanceFeeSummary | null> {
  const baseRows = await prisma.$queryRaw<Array<{ yearMonth: string | null }>>(Prisma.sql`
    SELECT MAX(yearMonth) AS yearMonth FROM KaptFeeSggMedian WHERE sggCode = ${NATIONAL_SGG}`);
  const baseMonth = baseRows[0]?.yearMonth ?? null;
  if (!baseMonth) return null;

  const [complexRows, medianRows, feeRows] = await Promise.all([
    prisma.$queryRaw<ComplexFeeRow[]>(Prisma.sql`
      SELECT householdCount, managementArea, raw
      FROM KaptComplex WHERE kaptCode = ${kaptCode} AND active = true LIMIT 1`),
    prisma.$queryRaw<Array<{ medianCommonPerM2: unknown; complexCount: unknown }>>(Prisma.sql`
      SELECT medianCommonPerM2, complexCount FROM KaptFeeSggMedian
      WHERE yearMonth = ${baseMonth}
        AND sggCode = (SELECT MIN(sggCode) FROM KaptComplexParcel WHERE kaptCode = ${kaptCode})`),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT ${FEE_SELECT} FROM KaptMaintenanceFee
      WHERE kaptCode = ${kaptCode} AND yearMonth >= ${shiftMonth(baseMonth, -HISTORY_MONTHS + 1)}
      ORDER BY yearMonth`),
  ]);
  const complex = complexRows[0];
  if (!complex) return null;

  const rows: FeeMonthRow[] = feeRows.map((row) => {
    const converted: FeeMonthRow = { yearMonth: String(row.yearMonth) };
    for (const [, column] of KAPT_FEE_COLUMNS) converted[column] = num(row[column]);
    return converted;
  });
  const median = medianRows[0];
  return summarizeMaintenanceFee({
    rows,
    baseMonth,
    householdCount: num(complex.householdCount),
    managementArea: num(complex.managementArea),
    sggMedian: median ? { median: Number(median.medianCommonPerM2), complexCount: Number(median.complexCount) } : null,
    office: officeFrom(complex.raw),
  });
}
