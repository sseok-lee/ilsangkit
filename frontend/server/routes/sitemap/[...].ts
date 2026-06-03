// catch-all 동적 카테고리 사이트맵 — Nitro가 [slug].xml.ts를 인식 못하는 문제 우회.
// 카테고리 목록과 per-category limit 은 sitemapPolicy 를 단일 소스로 참조해
// 인덱스(sitemap.xml.ts)와 완전히 동일한 청크 구성을 반환한다.
import { defineEventHandler, setHeader, createError } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapXml,
  formatDateForSitemap,
  fetchFacilityIds,
  fetchWasteScheduleIds,
  fetchRealEstateBuildings,
  fetchRealEstateCityDistrictHubs,
  fetchSubscriptionIds,
  fetchSubwaySlugs,
  getWeekStartDate,
} from '../../utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  getSitemapFacilityLimit,
  isSitemapFacilityCategory,
} from '../../utils/sitemapPolicy'
import { toAbsoluteRealEstateUrl, toCitySlug, toDistrictSlug, type RealEstateUrlType } from '~/utils/realEstateUrl'

// wifi는 noindex-only 상세 정책에 따라 사이트맵 인덱스에서 제외된 카테고리다.
// 동적 핸들러에서도 제외하여 sitemap URL은 404를 반환한다.
// AED는 색인 대상이므로 sitemapPolicy 에 포함해 chunk sitemap 을 제공한다.
const FACILITY_CATEGORIES = new Set<string>(SITEMAP_FACILITY_CATEGORIES)

function parseSlug(slug: string): { category: string; page: number } | null {
  // "real-estate-hub" → city/district hub sitemap (no pagination)
  if (slug === 'real-estate-hub') {
    return { category: 'real-estate-hub', page: 1 }
  }

  // "real-estate" → category='real-estate', page=1
  // "real-estate-3" → category='real-estate', page=3
  const reMatch = slug.match(/^real-estate(?:-(\d+))?$/)
  if (reMatch) {
    const page = reMatch[1] ? parseInt(reMatch[1], 10) : 1
    return page >= 1 ? { category: 'real-estate', page } : null
  }

  // "subscription" → category='subscription', page=1
  // "subscription-2" → category='subscription', page=2
  const subMatch = slug.match(/^subscription(?:-(\d+))?$/)
  if (subMatch) {
    const page = subMatch[1] ? parseInt(subMatch[1], 10) : 1
    return page >= 1 ? { category: 'subscription', page } : null
  }

  // "ev-charger" → category='ev-charger', page=1
  // "ev-charger-2" → category='ev-charger', page=2
  const evMatch = slug.match(/^ev-charger(?:-(\d+))?$/)
  if (evMatch) {
    const page = evMatch[1] ? parseInt(evMatch[1], 10) : 1
    return page >= 1 ? { category: 'ev-charger', page } : null
  }

  // "subway" → category='subway', page=1
  // "subway-2" → category='subway', page=2
  const subwayMatch = slug.match(/^subway(?:-(\d+))?$/)
  if (subwayMatch) {
    const page = subwayMatch[1] ? parseInt(subwayMatch[1], 10) : 1
    return page >= 1 ? { category: 'subway', page } : null
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

  setHeader(event, 'Content-Type', 'application/xml')

  // 부동산 건물 상세 페이지
  if (category === 'real-estate') {
    const buildings = await fetchRealEstateBuildings()
    if (buildings.length === 0 && page > 1) {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
    }
    const totalPages = Math.max(1, Math.ceil(buildings.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = buildings.slice(offset, offset + MAX_URLS_PER_SITEMAP)
    const weekStart = getWeekStartDate()

    const urls = pageItems.map((item) => ({
      loc: toAbsoluteRealEstateUrl(SITE_URL, {
        type: item.realEstateType as RealEstateUrlType,
        city: item.city,
        district: item.district,
        buildingName: item.buildingName,
      }),
      lastmod: weekStart,
      changefreq: 'weekly' as const,
      priority: 0.6,
    }))

    return generateSitemapXml(urls)
  }

  // 부동산 city/district 허브 페이지
  if (category === 'real-estate-hub') {
    const hubs = await fetchRealEstateCityDistrictHubs()
    const weekStart = getWeekStartDate()

    const seenCityUrls = new Set<string>()
    const urls: Parameters<typeof generateSitemapXml>[0] = []

    for (const hub of hubs) {
      const citySlug = toCitySlug(hub.city)
      const districtSlug = toDistrictSlug(hub.district)

      const cityUrl = `${SITE_URL}/real-estate/${hub.realEstateType}/${citySlug}`
      if (!seenCityUrls.has(cityUrl)) {
        seenCityUrls.add(cityUrl)
        urls.push({ loc: cityUrl, lastmod: weekStart, changefreq: 'weekly', priority: 0.7 })
      }

      const districtUrl = `${SITE_URL}/real-estate/${hub.realEstateType}/${citySlug}/${districtSlug}`
      urls.push({ loc: districtUrl, lastmod: weekStart, changefreq: 'weekly', priority: 0.6 })
    }

    return generateSitemapXml(urls)
  }

  // 지하철역 SEO 페이지 — self-canonical + sitemap 등록으로 정식 색인 대상
  if (category === 'subway') {
    const stations = await fetchSubwaySlugs()
    if (stations.length === 0 && page > 1) {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
    }
    const totalPages = Math.max(1, Math.ceil(stations.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = stations.slice(offset, offset + MAX_URLS_PER_SITEMAP)

    const urls = pageItems.map((item) => ({
      loc: `${SITE_URL}/subway/${item.slug}`,
      lastmod: formatDateForSitemap(item.updatedAt),
      changefreq: 'monthly' as const,
      priority: 0.5,
    }))

    return generateSitemapXml(urls)
  }

  // 청약 일정 상세 페이지
  if (category === 'subscription') {
    const subscriptions = await fetchSubscriptionIds()
    if (subscriptions.length === 0 && page > 1) {
      throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' })
    }
    const totalPages = Math.max(1, Math.ceil(subscriptions.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = subscriptions.slice(offset, offset + MAX_URLS_PER_SITEMAP)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const urls = pageItems.map((item) => {
      const updatedAt = new Date(item.updatedAt)
      const changefreq = updatedAt >= threeMonthsAgo ? 'monthly' : 'yearly'
      return {
        loc: `${SITE_URL}/subscription/${item.id}`,
        lastmod: formatDateForSitemap(item.updatedAt),
        changefreq: changefreq as 'monthly' | 'yearly',
        priority: 0.6,
      }
    })

    return generateSitemapXml(urls)
  }

  // 시설 카테고리 + trash — 인덱스와 동일한 limit을 적용해 청크 수가 어긋나지 않게 한다
  const items =
    category === 'trash'
      ? await fetchWasteScheduleIds()
      : await fetchFacilityIds(
          category,
          isSitemapFacilityCategory(category) ? getSitemapFacilityLimit(category) : undefined,
        )

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
