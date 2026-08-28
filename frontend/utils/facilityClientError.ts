/**
 * 시설 상세 클라이언트 네비게이션 에러 판정 (순수 함수).
 *
 * ## 왜 이 파일이 있나 — watch 안의 throw 는 삼켜진다
 *
 * `[category]/[id].vue` 는 `useAsyncData(..., { lazy: true })` 를 쓰므로 클라이언트
 * 네비게이션에서는 setup 이 끝난 뒤에 fetch 가 해소된다. 그래서 에러 처리를
 * `watch(fetchError, ...)` 에서 하는데, 거기서 `throw createError(...)` 를 하면
 * Vue 의 watcher 에러 핸들링(callWithErrorHandling)이 예외를 잡아 콘솔에만 남기고
 * Nuxt 의 showError 까지 전달하지 않는다. 결과는 에러 페이지가 아니라 **빈 페이지**다.
 *
 * 2026-08-28 프로덕션 실측 (라우터 push 로 클라이언트 네비게이션):
 *   /childcare/childcare-27230000317 (410)  →  title "일상킷 - 부동산 실거래가·청약·내 주변 생활정보"
 *   /childcare/childcare-00000000000 (404)  →  동일, h1 없음, <main> 없음, robots "index, follow"
 *   콘솔:  pa: Facility permanently removed  at Mt.immediate (watch 콜백)
 *
 * 같은 URL 을 직접 진입(SSR)하면 setup 본문에서 throw 하므로 정상 렌더된다 — 즉
 * SSR 경로만 맞고 CSR 경로는 계속 깨져 있었다. 사이트 기본 title 이 index,follow 로
 * 노출되는 건 2026-07 구글 색인 감소의 근본 원인이었던 그 실패 클래스다.
 *
 * 처방은 watch 안에서 `showError()` 를 부르는 것이고, 이 파일은 "어떤 상태코드를
 * 어떤 에러로 띄울지"를 throw/showError 배선과 분리해 테스트로 고정한다.
 */

export interface FacilityClientError {
  statusCode: number
  statusMessage: string
}

/**
 * 백엔드 상태코드 → 띄울 에러. 띄우지 않을 경우 null.
 *
 * 판정 순서와 근거는 resolveFacilitySsrOutcome 과 같다.
 *  - 410: FacilityGone 확정. 404 보다 먼저 본다(둘 다 확정 신호지만 410 이 구체적).
 *  - 404·422: 백엔드가 "없다"고 확정.
 *  - 그 외(5xx·네트워크 실패·undefined): 일시 장애이므로 에러 페이지를 띄우지 않는다.
 *    fail-open — 하드 404 로 굳히지 않고 사용자에게는 재시도 여지를 남긴다.
 */
export function resolveFacilityClientError(
  errorStatusCode?: number,
): FacilityClientError | null {
  if (errorStatusCode === 410) {
    return { statusCode: 410, statusMessage: 'Facility permanently removed' }
  }
  if (errorStatusCode === 404 || errorStatusCode === 422) {
    return { statusCode: 404, statusMessage: 'Facility not found' }
  }
  return null
}
