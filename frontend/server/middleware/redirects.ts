import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'
import { normalizePageQueryForUrl } from '../../utils/pageQuery'

const VALID_CITIES = new Set([
  'seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon',
  'ulsan', 'sejong', 'gyeonggi', 'gangwon', 'chungbuk', 'chungnam',
  'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
])

const SUFFIX_TEST = /-(gu|si|gun)(?=$|-)/
const SUFFIX_REPLACE = /-(gu|si|gun)(?=$|-)/g

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/api/') || path.startsWith('/_nuxt/') ||
      path.startsWith('/_ipx/') || path.startsWith('/__nuxt') ||
      path.startsWith('/sitemap') || path.startsWith('/icons/')) return

  // 리스트 페이지네이션 query 정규화 — malformed URL이 index/follow 1페이지처럼 렌더링되는 것을 방지한다.
  const url = getRequestURL(event)
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
