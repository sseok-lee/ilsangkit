/**
 * 시설 상세 SSR 응답 판정 (순수 함수).
 *
 * 원칙: 백엔드가 "없다"고 확정한 경우에만 404 를 낸다.
 * 그 외에 본문 데이터가 없으면 200 으로 렌더하지 말고 degraded(503)로 표시한다.
 *
 * 배경 — 기존 코드는 404/422 만 처리하고 5xx 는 그냥 통과시켰다. 백엔드 순간 장애 때
 * facility=null 인 채로 페이지가 렌더돼 사이트 기본 title 이 HTTP 200 + `index, follow`
 * 로 나갔고, 그게 그대로 색인됐다. 2026-07-28 네이버 중복 title 진단에 잡힌 결과:
 *   "일상킷 - 부동산 실거래가·청약·내 주변 생활정보"  50건 (크롤 2026-06-29 13:45:24~13:46:42)
 *   "일상킷 - 내 주변 생활 편의 정보"                50건 (구 태그라인 세대, 04-27~06-03)
 * 앞 그룹은 1분 남짓에 hospital·toilet·childcare·library·sports·trash 가 동시에 잡힌
 * 전형적인 순간 장애 버스트다. 두 그룹 다 표본 상한 50 에 걸려 있어 실제 규모는 최소 50건씩.
 *
 * fail-open 정책(#467)을 따른다 — 일시 장애를 noindex 나 하드 404 로 굳히지 않고
 * 503 + no-store 로만 표시해 크롤러가 기존 색인을 유지한 채 재방문하게 한다.
 */
export type FacilitySsrOutcome = 'ok' | 'not-found' | 'gone' | 'degraded'

export interface FacilitySsrInput {
  /** useAsyncData error 의 statusCode. 에러가 없으면 undefined. */
  errorStatusCode?: number
  /** useAsyncData status === 'success' (요청이 에러 없이 완료됨) */
  fetchSettled: boolean
  /** 응답 본문에 facility 데이터가 실제로 들어있는가 */
  hasData: boolean
}

export function resolveFacilitySsrOutcome(input: FacilitySsrInput): FacilitySsrOutcome {
  const { errorStatusCode, fetchSettled, hasData } = input

  // 백엔드가 FacilityGone 조회로 "영구히 제거됐다"고 확정한 경우.
  // 404 보다 먼저 본다 — 둘 다 확정 신호지만 410 이 더 구체적이다.
  // 데이터 유무와 무관하게 gone 이다(확정 신호가 본문보다 우선).
  if (errorStatusCode === 410) return 'gone'

  // 백엔드가 "이 시설은 없다"고 확정한 경우만 진짜 404.
  if (errorStatusCode === 404 || errorStatusCode === 422) return 'not-found'

  if (hasData) return 'ok'

  // 에러 없이 성공했는데 본문이 비었다 = 확정 부재.
  if (fetchSettled && errorStatusCode === undefined) return 'not-found'

  // 5xx · 네트워크 실패 · SSR 렌더 시점 미해결 → 일시 장애.
  // 여기서 throw 하면 정상 URL 이 하드 404 로 둔갑하고,
  // 그냥 두면 사이트 기본 title 이 200 으로 색인된다. 둘 다 막으려면 degraded 다.
  return 'degraded'
}
