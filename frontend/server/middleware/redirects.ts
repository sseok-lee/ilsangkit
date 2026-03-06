import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'

const VALID_CITIES = new Set([
  'seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon',
  'ulsan', 'sejong', 'gyeonggi', 'gangwon', 'chungbuk', 'chungnam',
  'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju',
])

const SUFFIX_PATTERN = /-(gu|si|gun)(?=$|-)/g

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (path.startsWith('/api/') || path.startsWith('/_nuxt/') ||
      path.startsWith('/sitemap') || path.startsWith('/icons/')) return

  const match = path.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/)
  if (!match) return

  const [, city, district, rest] = match
  if (!VALID_CITIES.has(city)) return
  if (!SUFFIX_PATTERN.test(district)) return

  // Reset lastIndex since we use global flag
  SUFFIX_PATTERN.lastIndex = 0
  const newSlug = district.replace(SUFFIX_PATTERN, '')
  const newPath = `/${city}/${newSlug}${rest || ''}`
  return sendRedirect(event, newPath, 301)
})
