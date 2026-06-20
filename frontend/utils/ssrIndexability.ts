/**
 * SSR 페이지의 noindex 출력 여부 판정 (순수 함수).
 *
 * 원칙: 일시적 fetch 실패(fetchFailed)는 절대 noindex로 굳히지 않는다(fail-open).
 * noindex는 (1) 적극 증거(positiveNoindex: 지번 패턴 등) 또는
 * (2) fetch 성공 + 진짜 빈값(confirmedEmpty)일 때만.
 */
export interface SsrIndexabilityInput {
  /** 지번 패턴 등, fetch와 무관한 색인부적합 확정 증거. true면 무조건 noindex. */
  positiveNoindex?: boolean
  /** SSR fetch가 일시 실패(reject/5xx/timeout/network)했는가. true면 절대 noindex 안 함. */
  fetchFailed: boolean
  /** fetch 성공 + 엔티티가 진짜 비어있음(백엔드 404/빈 결과 확정). */
  confirmedEmpty: boolean
}

export function shouldNoindexSsr(input: SsrIndexabilityInput): boolean {
  if (input.positiveNoindex) return true
  if (input.fetchFailed) return false
  return input.confirmedEmpty
}
