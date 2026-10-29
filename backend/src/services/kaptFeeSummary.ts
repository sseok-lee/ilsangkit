// K-apt 관리비 행(단지 × 월) → 상세 "관리비" 섹션 요약.
//
// 모든 금액은 세대 평균 = 단지 월 부과액 ÷ 세대수(원 반올림). 평형별 금액은 원본에 없어 만들지 않는다.
// 세대 평균 월 합계(공용+개별+장충)가 정상 범위를 벗어난 달은 원본 오류로 보고 모든 계산에서 뺀다.
// - 큰 숫자: 기준 월. 이 단지에 기준 월 행이 없으면 최대 2개월 전까지 최근 정상 달로 대체.
//   기준 월 행이 있는데 범위 밖이면 대체하지 않고 숨긴다(오류 단지를 다른 달로 덮지 않는다).
// - 여름: 가장 최근 7·8월(둘 다), 겨울: 가장 최근 12·1·2월(셋 다), 연평균: 기준 월로 끝나는 12개월 중 10개월 이상.
// - ㎡당 공용관리비 비교는 기준 월끼리만(다른 달과 비교하지 않는다).

import type { MaintenanceFeeItem, MaintenanceFeeSummary, FeePeriodAverage } from '../types/housingRedesign.js';
import { isValidMonthlyFee } from './kaptFeeStats.js';

export interface FeeMonthRow {
  /** YYYYMM */
  yearMonth: string;
  /** KaptMaintenanceFee 금액 컬럼(원). BigInt 는 호출자가 Number 로 바꿔 넘긴다. */
  [column: string]: number | null | string;
}

export interface SummarizeFeeInput {
  rows: FeeMonthRow[];
  /** 전국 기준 월 YYYYMM */
  baseMonth: string;
  householdCount: number | null;
  managementArea: number | null;
  sggMedian: { median: number; complexCount: number } | null;
  office: { phone: string | null; address: string | null };
}

const FALLBACK_MONTHS = 2;
const YEARLY_MIN_MONTHS = 10;

/** 항목 상세 — [묶음, 표시 이름, 더할 컬럼들] */
const ITEM_DEFINITIONS: ReadonlyArray<readonly [MaintenanceFeeItem['group'], string, readonly string[]]> = [
  ['common', '일반관리비', ['generalTotal']],
  ['common', '청소비', ['cleaning']],
  ['common', '경비비', ['security']],
  ['common', '소독비', ['disinfection']],
  ['common', '승강기유지비', ['elevator']],
  ['common', '지능형네트워크유지비', ['network']],
  ['common', '수선유지비', ['repairTotal']],
  ['common', '위탁관리수수료', ['managementFee']],
  ['individual', '난방비', ['heatingCommon', 'heatingPrivate']],
  ['individual', '급탕비', ['hotWaterCommon', 'hotWaterPrivate']],
  ['individual', '가스사용료', ['gasCommon', 'gasPrivate']],
  ['individual', '전기료', ['electricityCommon', 'electricityPrivate']],
  ['individual', '수도료', ['waterCommon', 'waterPrivate']],
  ['individual', 'TV수신료', ['tvFee']],
  ['individual', '정화조오물수수료', ['septicFee']],
  ['individual', '생활폐기물수수료', ['wasteFee']],
  ['individual', '입대의운영비', ['councilFee']],
  ['individual', '건물보험료', ['buildingInsurance']],
  ['individual', '선관위운영비', ['electionFee']],
  ['individual', '기타', ['etc']],
  ['longTermRepair', '장기수선충당금', ['ltrCharge']],
];

const amount = (row: FeeMonthRow, column: string): number => {
  const value = row[column];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/** 'YYYYMM' ± n 개월 */
function shiftMonth(yearMonth: string, delta: number): string {
  const index = Number(yearMonth.slice(0, 4)) * 12 + Number(yearMonth.slice(4, 6)) - 1 + delta;
  return `${Math.floor(index / 12)}${String((index % 12) + 1).padStart(2, '0')}`;
}

const display = (yearMonth: string): string => `${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}`;

function average(months: string[], perHousehold: Map<string, number>): FeePeriodAverage {
  const sum = months.reduce((acc, month) => acc + perHousehold.get(month)!, 0);
  return { from: display(months[0]), to: display(months.at(-1)!), amount: Math.round(sum / months.length), months: months.length };
}

/** 가장 최근에 끝나는 계절(달 묶음이 모두 정상인 것). months 는 첫 달 기준 상대 개월. */
function latestSeason(
  perHousehold: Map<string, number>,
  lastMonthOfSeason: string,
  length: number,
): FeePeriodAverage | null {
  const ends = [...perHousehold.keys()].filter((m) => m.slice(4, 6) === lastMonthOfSeason).sort().reverse();
  for (const end of ends) {
    const months = Array.from({ length }, (_, i) => shiftMonth(end, i - length + 1));
    if (months.every((m) => perHousehold.has(m))) return average(months, perHousehold);
  }
  return null;
}

export function summarizeMaintenanceFee(input: SummarizeFeeInput): MaintenanceFeeSummary | null {
  const households = input.householdCount;
  if (!households || households <= 0) return null;

  const rowByMonth = new Map(input.rows.map((row) => [row.yearMonth, row]));
  const totalOf = (row: FeeMonthRow): number =>
    (amount(row, 'commonTotal') + amount(row, 'individualTotal') + amount(row, 'ltrCharge')) / households;

  // 정상 달만: 'YYYYMM' → 세대 평균 월 합계(반올림 전)
  const perHousehold = new Map<string, number>();
  for (const row of input.rows) {
    const value = totalOf(row);
    if (isValidMonthlyFee(value)) perHousehold.set(row.yearMonth, value);
  }

  const baseRow = rowByMonth.get(input.baseMonth);
  let shownMonth: string | null = null;
  if (baseRow) {
    if (!perHousehold.has(input.baseMonth)) return null;
    shownMonth = input.baseMonth;
  } else {
    for (let delta = 1; delta <= FALLBACK_MONTHS && !shownMonth; delta++) {
      const candidate = shiftMonth(input.baseMonth, -delta);
      if (perHousehold.has(candidate)) shownMonth = candidate;
    }
  }
  if (!shownMonth) return null;
  const shown = rowByMonth.get(shownMonth)!;
  const perUnit = (value: number): number => Math.round(value / households);

  const window = Array.from({ length: 12 }, (_, i) => shiftMonth(input.baseMonth, i - 11));
  const windowValid = window.filter((m) => perHousehold.has(m));
  const after = [...perHousehold.keys()].filter((m) => m > input.baseMonth).sort();
  const monthly = [
    ...windowValid.map((m) => ({ month: display(m), amount: Math.round(perHousehold.get(m)!), partial: false })),
    ...after.map((m) => ({ month: display(m), amount: Math.round(perHousehold.get(m)!), partial: true })),
  ];

  const area = input.managementArea;
  const commonPerM2 = shownMonth === input.baseMonth && area && area > 0 && input.sggMedian
    ? {
        complex: Math.round(amount(shown, 'commonTotal') / area),
        sggMedian: input.sggMedian.median,
        sggComplexCount: input.sggMedian.complexCount,
      }
    : null;

  const items = ITEM_DEFINITIONS
    .map(([group, label, columns]) => ({
      group,
      label,
      amount: perUnit(columns.reduce((acc, column) => acc + amount(shown, column), 0)),
    }))
    .filter((item) => item.amount > 0);

  return {
    month: display(shownMonth),
    total: Math.round(perHousehold.get(shownMonth)!),
    common: perUnit(amount(shown, 'commonTotal')),
    individual: perUnit(amount(shown, 'individualTotal')),
    longTermRepair: perUnit(amount(shown, 'ltrCharge')),
    summer: latestSeason(perHousehold, '08', 2),
    winter: latestSeason(perHousehold, '02', 3),
    yearly: windowValid.length >= YEARLY_MIN_MONTHS ? average(windowValid, perHousehold) : null,
    monthly,
    commonPerM2,
    items,
    office: input.office,
  };
}
