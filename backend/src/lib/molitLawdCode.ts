/**
 * Region 표 bjdCode → 국토부 실거래 API LAWD_CD 별칭.
 * Region 표의 세종 코드 36111 은 국토부 실거래 API 가 데이터를 주지 않고 36110 만 응답한다
 * (2026-10-20 실측: 2026-09 아파트매매 36110 → 519건, 36111 → 0건).
 * 거래 bjdCode 도 36110 으로 저장되므로 Region 코드로 거래를 거를 때도 이 별칭을 쓴다.
 */
export const MOLIT_LAWD_CODE_ALIASES: Record<string, string> = { '36111': '36110' };

export function toMolitLawdCode(bjdCode: string): string {
  return MOLIT_LAWD_CODE_ALIASES[bjdCode] ?? bjdCode;
}
