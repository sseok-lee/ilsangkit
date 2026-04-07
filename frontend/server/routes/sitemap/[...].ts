// catch-all 동적 카테고리 사이트맵 — Nitro가 [slug].xml.ts를 인식 못하는 문제 우회
import { defineEventHandler, setHeader, createError } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapXml,
  formatDateForSitemap,
  fetchFacilityIds,
  fetchWasteScheduleIds,
  fetchRealEstateBuildings,
} from '../../utils/sitemap'

// wifi/aed는 사이트맵 인덱스에서 제외된 카테고리 — 동적 핸들러에서도 제외하여 404 반환
const FACILITY_CATEGORIES = new Set(['toilet', 'clothes', 'parking', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'])

function parseSlug(slug: string): { category: string; page: number } | null {
  // "real-estate" → category='real-estate', page=1
  // "real-estate-3" → category='real-estate', page=3
  const reMatch = slug.match(/^real-estate(?:-(\d+))?$/)
  if (reMatch) {
    const page = reMatch[1] ? parseInt(reMatch[1], 10) : 1
    return page >= 1 ? { category: 'real-estate', page } : null
  }

  // "ev-charger" → category='ev-charger', page=1
  // "ev-charger-2" → category='ev-charger', page=2
  const evMatch = slug.match(/^ev-charger(?:-(\d+))?$/)
  if (evMatch) {
    const page = evMatch[1] ? parseInt(evMatch[1], 10) : 1
    return page >= 1 ? { category: 'ev-charger', page } : null
  }

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

  setHeader(event, 'Content-Type', 'application/xml')

  // 부동산 건물 상세 페이지
  if (category === 'real-estate') {
    const buildings = await fetchRealEstateBuildings(apiBase)
    if (buildings.length === 0 && page > 1) {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
    }
    const totalPages = Math.max(1, Math.ceil(buildings.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = buildings.slice(offset, offset + MAX_URLS_PER_SITEMAP)
    const today = new Date().toISOString().split('T')[0]

    const urls = pageItems.map((item) => ({
      loc: `${SITE_URL}/real-estate/${item.propertyType}/${encodeURIComponent(item.buildingName)}?bjdCode=${item.bjdCode}`,
      lastmod: today,
      changefreq: 'weekly' as const,
      priority: 0.6,
    }))

    return generateSitemapXml(urls)
  }

  // 시설 카테고리 + trash
  const items =
    category === 'trash'
      ? await fetchWasteScheduleIds(apiBase)
      : await fetchFacilityIds(category, apiBase)

  // API 실패로 데이터 없음 — 503으로 크롤러 재시도 유도 (빈 sitemap 캐시 방지)
  if (items.length === 0 && page > 1) {
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
  }
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

  return generateSitemapXml(urls)
})
