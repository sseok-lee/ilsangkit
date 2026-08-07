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
export function buildPageHref(
  path: string,
  query: Record<string, unknown>,
  page: number,
): string {
  const basePath = path.split('?')[0]
  const params = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(query)) {
    if (key === 'page') continue
    // route.query 값은 string | string[] | null 이 될 수 있다.
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }

  if (page > 1) params.set('page', String(page))

  const queryString = params.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}
