// catch-all 동적 카테고리 사이트맵 — Nitro가 [slug].xml.ts를 인식 못하는 문제 우회
import { defineEventHandler, setHeader, createError } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapXml,
  formatDateForSitemap,
  fetchFacilityIds,
  fetchWasteScheduleIds,
} from '../../utils/sitemap'

const FACILITY_CATEGORIES = new Set(['toilet', 'wifi', 'clothes', 'kiosk'])

function parseSlug(slug: string): { category: string; page: number } | null {
  // "wifi-2" → category='wifi', page=2
  // "toilet" → category='toilet', page=1
  const match = slug.match(/^([a-z]+?)(?:-(\d+))?$/)
  if (!match) return null

  const category = match[1]
  const page = match[2] ? parseInt(match[2], 10) : 1

  if (!FACILITY_CATEGORIES.has(category) && category !== 'trash') return null
  if (page < 1) return null

  return { category, page }
}

export default defineEventHandler(async (event) => {
  // URL path에서 slug 추출: /sitemap/wifi-1.xml → wifi-1
  const path = event.path || ''
  const lastSegment = path.split('/').pop() || ''

  // .xml 확장자 필수
  if (!lastSegment.endsWith('.xml')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const slug = lastSegment.replace(/\.xml$/, '')
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const parsed = parseSlug(slug)
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { category, page } = parsed
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  // 데이터 fetch
  const items =
    category === 'trash'
      ? await fetchWasteScheduleIds(apiBase)
      : await fetchFacilityIds(category, apiBase)

  // 페이지 유효성 검증
  const totalPages = Math.max(1, Math.ceil(items.length / MAX_URLS_PER_SITEMAP))
  if (page > totalPages) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // slice로 해당 페이지 항목 추출
  const offset = (page - 1) * MAX_URLS_PER_SITEMAP
  const pageItems = items.slice(offset, offset + MAX_URLS_PER_SITEMAP)

  const urls = pageItems.map((item) => ({
    loc: `${SITE_URL}/${category}/${item.id}`,
    lastmod: formatDateForSitemap(item.updatedAt),
    changefreq: 'monthly' as const,
    priority: 0.6,
  }))

  setHeader(event, 'Content-Type', 'application/xml')
  return generateSitemapXml(urls)
})
