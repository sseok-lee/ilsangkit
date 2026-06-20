/**
 * SSR 응답을 "일시 degraded"로 표시한다.
 * - HTTP 503 + cache-control:no-store → 크롤러는 기존 색인 유지+재방문, Nitro SWR 캐시 우회.
 * - 본문은 그대로 렌더(throw 안 함)되어 실사용자는 클라이언트 refetch로 정상 표시.
 * - 클라이언트(SSR 이벤트 없음)에서는 no-op.
 *
 * useRequestEvent/setResponseStatus/setResponseHeader 는 Nuxt 자동 import.
 */
export function markDegradedResponse(statusCode = 503): void {
  const event = useRequestEvent()
  if (!event) return
  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'cache-control', 'no-store')
}
