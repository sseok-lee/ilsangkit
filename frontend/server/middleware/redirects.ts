import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'
import { normalizePageQueryForUrl } from '../../utils/pageQuery'

// 2026-07 전남광주통합특별시 정규화(jeonnamgwangju) 신 slug 수용.
// 옛 slug(gwangju/jeonnam)는 여전히 VALID_CITIES 에 남겨 구 URL(-gu/-si/-gun suffix 등)도 계속 동작시킨다.
// 실제 gwangju/jeonnam → jeonnamgwangju 301은 resolveRegionReorgRedirect 가 별도로 담당(REGION_REORG_301 플래그).
export const VALID_CITIES = new Set([
  'seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon',
  'ulsan', 'sejong', 'gyeonggi', 'gangwon', 'chungbuk', 'chungnam',
  'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
  'jeonnamgwangju',
])

const SUFFIX_TEST = /-(gu|si|gun)(?=$|-)/
const SUFFIX_REPLACE = /-(gu|si|gun)(?=$|-)/g

/**
 * 2026-07 전남광주통합특별시 정규화 — 옛 slug(gwangju/jeonnam) URL → 신 slug(jeonnamgwangju) 301.
 *
 * env `REGION_REORG_301`='1' 일 때만 발동(Phase A는 로직만 심고 기본 OFF, 실제 활성은 Phase B 말미).
 * 순수함수로 추출해 두 URL 형태를 한 곳에서 판정:
 *   - bare city hub: `/gwangju`, `/jeonnam` (단일 세그먼트)
 *   - 시설 지역: `/gwangju/{district}[/{category}][...]` (2세그+, district·category 이하 세그먼트는 불변)
 *
 * 부동산 NEW-format(`/real-estate/{type}-{mode}/{city}/{district}[/{building}]`)은
 * segments[1]==='real-estate' 이라 아래 분기에 걸리지 않는다 — real-estate-redirect.ts 의
 * resolveRegionReorgCityRedirect 가 별도로 담당(체인 방지 pass-through 보다 먼저 호출).
 */
const LEGACY_JNGJ_CITIES = new Set(['gwangju', 'jeonnam'])
const JNGJ_SLUG = 'jeonnamgwangju'

export function resolveRegionReorgRedirect(
  pathname: string,
  search: string,
  flagOn: boolean,
): { target: string } | null {
  if (!flagOn) return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const city = segments[0]
  if (!LEGACY_JNGJ_CITIES.has(city)) return null

  const rest = segments.slice(1).join('/')
  const target = rest ? `/${JNGJ_SLUG}/${rest}${search}` : `/${JNGJ_SLUG}${search}`
  return { target }
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/api/') || path.startsWith('/_nuxt/') ||
      path.startsWith('/_ipx/') || path.startsWith('/__nuxt') ||
      path.startsWith('/sitemap') || path.startsWith('/icons/')) return

  const url = getRequestURL(event)

  // 전남광주통합특별시 정규화 301 (REGION_REORG_301='1' 일 때만, 기본 OFF)
  const reorgRedirect = resolveRegionReorgRedirect(
    path,
    url.search,
    process.env.REGION_REORG_301 === '1',
  )
  if (reorgRedirect) {
    return sendRedirect(event, reorgRedirect.target, 301)
  }

  // 리스트 페이지네이션 query 정규화 — malformed URL이 index/follow 1페이지처럼 렌더링되는 것을 방지한다.
  const normalizedPageUrl = normalizePageQueryForUrl(path, url.search)
  if (normalizedPageUrl) {
    return sendRedirect(event, normalizedPageUrl, 301)
  }

  // Trailing slash → canonical 중복 제거 (예: /toilet/ → /toilet)
  if (path !== '/' && path.endsWith('/')) {
    const search = getRequestURL(event).search
    return sendRedirect(event, `${path.slice(0, -1)}${search}`, 301)
  }

  const match = path.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/)
  if (!match) return

  const [, city, district, rest] = match
  if (!VALID_CITIES.has(city)) return
  if (!SUFFIX_TEST.test(district)) return

  const newSlug = district.replace(SUFFIX_REPLACE, '')
  const search = getRequestURL(event).search
  const newPath = `/${city}/${newSlug}${rest || ''}${search}`
  return sendRedirect(event, newPath, 301)
})
