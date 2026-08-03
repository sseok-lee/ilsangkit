/**
 * 최근 N개월(당월 포함) 거래를 고르는 **sargable** WHERE 조건을 만든다.
 *
 * 왜 이 함수가 따로 있는가 —
 * `WHERE dealYear * 100 + dealMonth >= 202606` 은 컬럼에 연산이 걸려 인덱스를 못 탄다.
 * 운영 실측(2026-08-03, AptSaleTransaction 1,557,394행): 비sargable 5,862ms vs
 * sargable 529ms — 같은 결과에 11배 차이. 이 형태를 쓰는 곳이 이미 있으므로
 * (realEstateHubSummaryService) 새로 쓰는 코드는 반드시 이 함수를 경유한다.
 *
 * 반환하는 sql 은 파라미터 3개를 소비한다: [cutoffYear, cutoffMonth, cutoffYear]
 */
export function recentMonthsCondition(
  months: number,
  now: Date,
): { sql: string; params: number[] } {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`months must be a positive integer, got ${months}`);
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12

  // 당월 포함이므로 months-1 만큼 뒤로 간다
  let cutoffYear = year;
  let cutoffMonth = month - (months - 1);
  while (cutoffMonth <= 0) {
    cutoffMonth += 12;
    cutoffYear -= 1;
  }

  return {
    sql: '((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)',
    params: [cutoffYear, cutoffMonth, cutoffYear],
  };
}
