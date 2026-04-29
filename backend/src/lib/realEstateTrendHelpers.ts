// 월간 변동률 계산 유틸 (RealEstateTrend 배치 잡 + API 공유).

export type AreaBucket = '59㎡대' | '84㎡대' | '114㎡대' | '기타';

export const AREA_BUCKETS: AreaBucket[] = ['59㎡대', '84㎡대', '114㎡대', '기타'];

/**
 * 전용면적(㎡) → 평형 버킷.
 * 한국 아파트 표준 평형(59/74/84/114)을 단순 3-그룹으로 매핑.
 *
 * - <60 → '59㎡대'
 * - 60~89 → '84㎡대'
 * - 90~129 → '114㎡대'
 * - 그 외 / null → '기타'
 */
export function classifyAreaBucket(exclusiveArea: number | null | undefined): AreaBucket {
  if (exclusiveArea == null || Number.isNaN(exclusiveArea)) return '기타';
  if (exclusiveArea < 60) return '59㎡대';
  if (exclusiveArea < 90) return '84㎡대';
  if (exclusiveArea < 130) return '114㎡대';
  return '기타';
}

/**
 * Trimmed mean — 상·하위 trimRatio 비율을 제거한 후 평균.
 *
 * - 빈 배열 → null
 * - 양쪽 trim 후 표본이 0이면 null
 * - trimRatio는 0~0.5 사이로 clamp
 */
export function trimmedMean(values: number[], trimRatio: number = 0.1): number | null {
  if (values.length === 0) return null;
  const ratio = Math.max(0, Math.min(0.5, trimRatio));
  const sorted = [...values].sort((a, b) => a - b);
  const k = Math.floor(sorted.length * ratio);
  const trimmed = sorted.slice(k, sorted.length - k);
  if (trimmed.length === 0) return null;
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return sum / trimmed.length;
}

/**
 * (current - previous) / previous.
 * previous가 null/0이면 null (변동률 정의 불가).
 */
export function calcChangeRatio(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * year, month → 'YYYY-MM' 문자열.
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * 'YYYY-MM' + delta(개월) → 'YYYY-MM'.
 * delta가 음수면 과거, 양수면 미래.
 */
export function shiftMonth(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split('-').map((s) => Number(s));
  if (Number.isNaN(y) || Number.isNaN(m)) {
    throw new Error(`Invalid yearMonth: ${yearMonth}`);
  }
  const totalMonthIndex = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(totalMonthIndex / 12);
  const nm = (totalMonthIndex % 12) + 1;
  return formatYearMonth(ny, nm);
}

/**
 * 표본 수 5건 미만이면 변동률·평균 신뢰도가 낮다고 판단.
 * UI 측에서 null 처리(보합 표시)하기 위한 게이트.
 */
export const MIN_SAMPLE_SIZE_FOR_TREND = 5;

export function isSampleSizeSufficient(count: number): boolean {
  return count >= MIN_SAMPLE_SIZE_FOR_TREND;
}
