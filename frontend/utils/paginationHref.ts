/**
 * 페이지네이션 링크(`<a href>`)용 URL 생성기.
 *
 * 크롤러는 click 핸들러를 실행하지 않으므로, 페이지네이션이 `<button>` 으로만 렌더되면
 * 2페이지 이후로 가는 크롤 경로가 존재하지 않는다. 목록의 첫 20건을 제외한 상세 URL 이
 * 내부 링크 0 인 "사이트맵 전용 고아"가 되어 발견되지 않는다.
 *
 * 여기서 만드는 href 는 클릭 후 SPA 가 만드는 URL(`syncPageQuery`)과 정확히 같아야 한다.
 * 어긋나면 크롤러가 보는 페이지와 사용자가 보는 페이지가 갈라진다.
 * 그래서 page 1 은 page 키 자체를 제거해 canonical URL 과 동일하게 유지한다.
 */

/**
 * 페이지네이션 URL 에 절대 실어서는 안 되는 "UI 상태" 쿼리 키.
 *
 * `?schedule=N` 은 쓰레기 배출 상세 모달을 여는 UI 상태다. 목록의 canonical 은 항상
 * 쿼리 없는 지역 허브(`/chungnam/buyeo/trash`)를 가리키므로, 이 키가 링크에 섞이면
 * `/chungnam/buyeo/trash?schedule=13343&page=2` 같은 크롤 가능한 파라미터 URL 이 새로 생긴다.
 * 모달이 열린 상태에서 렌더된 페이지네이션 `<a href>` 가 그대로 파라미터 공간의 입구가 된다.
 * 2026-08 네이버 중복 title 진단에서 `?schedule=` 파라미터 색인이 표본의 27% 를 차지했고,
 * 2026-09-04 실측 기준 중복 title 22.5만 건이 남아 있다 — 링크를 만드는 쪽에서 끊는다.
 *
 * 모달 딥링크 자체는 공유 가능한 URL 이라 살려둔다(301 도 404 도 아님). 여기서 막는 것은
 * "크롤러가 그 파라미터 공간을 계속 발견하는 경로"뿐이다.
 */
export const UI_STATE_QUERY_KEYS: readonly string[] = ['schedule']

const UI_STATE_QUERY_KEY_SET = new Set<string>(UI_STATE_QUERY_KEYS)

/** UI 상태 키인지 판별. buildPageHref 와 각 페이지의 syncPageQuery 가 같은 목록을 공유한다. */
export function isUiStateQueryKey(key: string): boolean {
  return UI_STATE_QUERY_KEY_SET.has(key)
}

/**
 * UI 상태 키를 제거한 쿼리 사본.
 * 페이지 이동 시 SPA 가 만드는 URL(`syncPageQuery`)도 이 함수를 통과해야
 * `<a href>` 와 클릭 결과가 문자 단위로 일치한다.
 */
export function stripUiStateQuery<T>(query: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(query)) {
    if (isUiStateQueryKey(key)) continue
    next[key] = value
  }
  return next
}

export function buildPageHref(
  path: string,
  query: Record<string, unknown>,
  page: number,
): string {
  const basePath = path.split('?')[0]
  const params = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(query)) {
    if (key === 'page') continue
    // UI 상태(모달 등)는 링크로 새어나가면 안 된다 — 위 UI_STATE_QUERY_KEYS 주석 참고.
    if (isUiStateQueryKey(key)) continue
    // route.query 값은 string | string[] | null 이 될 수 있다.
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }

  if (page > 1) params.set('page', String(page))

  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}
