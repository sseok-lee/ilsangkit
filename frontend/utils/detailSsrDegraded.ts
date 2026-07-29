/**
 * 상세 페이지 SSR 이 "일시 장애 상태"인지 판정 (순수 함수).
 *
 * ## 배경 — 옵셔널 체이닝이 가드를 무력화한다
 *
 * 부동산 건물 상세는 핸들러 안에서 실패를 잡아 `infoFetchFailed` 플래그로 표시하고,
 * 바깥에서 그 플래그만 보고 degraded 를 걸었다.
 *
 *     if (import.meta.server && ssrData.value?.infoFetchFailed) markDegradedResponse()
 *
 * 문제는 그 플래그가 핸들러 "반환값 안에" 있다는 점이다. 핸들러가 통째로 throw 하면
 * (핸들러 내 try 바깥의 실패, 네트워크 단절 등) `ssrData` 는 null 이고
 * `ssrData.value?.infoFetchFailed` 는 undefined → falsy → 가드가 그냥 통과한다.
 * 결과적으로 데이터 없는 페이지가 HTTP 200 으로 나간다 — 2026-07 색인 오염의 바로 그 경로다.
 *
 * 정작 그 경우를 잡아줄 `error` ref 는 구조분해만 해두고 한 번도 쓰이지 않았다.
 *
 * 그래서 판정을 세 입력으로 나눠 명시한다. 하나라도 어긋나면 degraded 다.
 *
 * fail-open 정책(#467)을 따른다 — 판정 결과는 503 + no-store 표시에만 쓰고,
 * 404 나 영구 noindex 로 굳히지 않는다. 본문은 계속 렌더되어 실사용자는
 * 클라이언트 refetch 로 정상 표시된다.
 */
export interface DetailSsrDegradedInput {
  /** useAsyncData 의 error 가 채워졌는가 */
  hasError: boolean
  /** 핸들러가 반환값을 남겼는가 (throw 하면 false) */
  hasData: boolean
  /** 핸들러가 반환값 안에 스스로 표시한 실패 플래그 */
  explicitFailure?: boolean
}

export function isDetailSsrDegraded(input: DetailSsrDegradedInput): boolean {
  return input.hasError || !input.hasData || input.explicitFailure === true
}
