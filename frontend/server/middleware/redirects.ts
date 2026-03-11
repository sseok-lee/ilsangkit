import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'

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

  const match = path.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/)
  if (!match) return

  const [, city, district, rest] = match
  if (!VALID_CITIES.has(city)) return
  if (!SUFFIX_TEST.test(district)) return

  const newSlug = district.replace(SUFFIX_REPLACE, '')
  const newPath = `/${city}/${newSlug}${rest || ''}`
  return sendRedirect(event, newPath, 301)
})
