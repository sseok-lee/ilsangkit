/**
 * 부동산 목록 페이지 SSR 응답 판정 (순수 함수).
 *
 * 원칙: "백엔드 장애로 못 받았다"와 "정상적으로 0건이다"를 구분한다.
 * 목록 페이지에서 0건은 정상 상태이므로 404 의미가 없다 — 그래서 시설 상세의
 * resolveFacilitySsrOutcome 과 달리 not-found 판정이 없다.
 *
 * 배경 — 기존 코드는 둘을 구분하지 않고 "항목 0건"이면 no-store 만 걸었다.
 *   if (import.meta.server && items.length === 0) {
 *     useResponseHeader('cache-control').value = 'no-store'
 *   }
 * 응답은 여전히 HTTP 200 + `index, follow` 였고, routeRules 의
 * swr(s-maxage=300)이 no-store 를 덮어써 빈 본문이 5분간 캐시됐다.
 *
 * 2026-07-29 실측 (백엔드 8000 다운 + dev SSR):
 *   /real-estate/apt-sale            200  cache-control: s-maxage=300, stale-while-revalidate
 *   /real-estate/land/seoul          200  (동일)
 *   /real-estate/land/seoul/gangnam  200  (동일)
 * 본문 가시 텍스트 1,122자 중 대부분이 푸터·출처 보일러플레이트이고
 * 콘텐츠 자리에는 "…지 거래 데이터가 준비 중입니다" 만 남았다.
 * 즉 백엔드 장애 1회가 "데이터 없음" 페이지를 5분간 크롤러에 서빙한다.
 *
 * fail-open 정책(#467)을 따른다 — 일시 장애를 404 나 영구 noindex 로 굳히지 않고
 * 503 + no-store 로만 표시해 크롤러가 기존 색인을 유지한 채 재방문하게 한다.
 * 503 은 swr 에 덮이지 않는다(시설 상세 경로에서 실측 확인).
 */
export type RealEstateListSsrOutcome = 'ok' | 'empty' | 'degraded'

export interface RealEstateListSsrInput {
  /** useAsyncData 가 error 를 냈는가 (5xx · 네트워크 실패 등) */
  hasError: boolean
  /** useAsyncData status === 'success' (요청이 에러 없이 완료됨) */
  fetchSettled: boolean
  /** 목록에 렌더할 항목이 실제로 있는가 */
  hasItems: boolean
}

export function resolveRealEstateListSsrOutcome(
  input: RealEstateListSsrInput,
): RealEstateListSsrOutcome {
  const { hasError, fetchSettled, hasItems } = input

  // 렌더할 항목이 있으면 잔여 에러가 있어도 정상 응답이다.
  // degraded 판정이 멀쩡한 페이지를 503 으로 강등시키면 안 된다.
  if (hasItems) return 'ok'

  // 에러 · SSR 렌더 시점 미해결 → 일시 장애.
  // 여기서 200 으로 렌더하면 빈 본문이 swr 캐시에 박혀 색인된다.
  if (hasError || !fetchSettled) return 'degraded'

  // 에러 없이 성공했는데 0건 = 실제로 거래가 없는 지역. 정상 페이지다.
  return 'empty'
}
