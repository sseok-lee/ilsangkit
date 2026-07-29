/**
 * SSR 응답을 "일시 degraded"로 표시한다.
 * - HTTP 503 + cache-control:no-store → 크롤러는 기존 색인 유지+재방문, Nitro SWR 캐시 우회.
 * - 본문은 그대로 렌더(throw 안 함)되어 실사용자는 클라이언트 refetch로 정상 표시.
 * - 클라이언트(SSR 이벤트 없음)에서는 no-op.
 *
 * useRequestEvent/setResponseStatus/useResponseHeader 는 Nuxt 앱 자동 import.
 *
 * ⚠️ h3 의 setResponseHeader 를 쓰면 안 된다. 그건 server/ 디렉터리(Nitro) 전용 자동
 *    import 라서 앱 번들에는 import 가 붙지 않고 자유 변수로 남는다. 그러면 이 함수가
 *    실행되는 순간 ReferenceError 가 나고, Nuxt 가 그 예외를 잡아 에러 페이지를 렌더한다
 *    — 에러 페이지 색인을 막으려고 만든 함수가 정작 에러 페이지를 만드는 상태가 된다.
 *    앱 코드에서는 Nuxt 의 useResponseHeader() 를 쓴다.
 */
export function markDegradedResponse(statusCode = 503): void {
  const event = useRequestEvent()
  if (!event) return
  setResponseStatus(event, statusCode)
  useResponseHeader('cache-control').value = 'no-store'
}
