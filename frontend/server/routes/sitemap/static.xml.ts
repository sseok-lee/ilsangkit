// 정적 + 지역 조합 페이지 사이트맵
import { defineEventHandler, setHeader } from 'h3'
import { SITE_URL, generateSitemapXml } from '../../utils/sitemap'
import type { SitemapUrl } from '../../utils/sitemap'
import { CITY_SLUGS, DISTRICT_SLUG_MAP, REGIONS, getDistrictSlug } from '../../../shared/regionSlugs'

const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy']

// Fallback: API 실패 시 도시/구군 허브 페이지만 추가 (빈 카테고리 조합은 제외)
function addFallbackHubPages(urls: SitemapUrl[], today: string): void {
  for (const [cityName, districts] of Object.entries(REGIONS)) {
    const citySlug = CITY_SLUGS[cityName]
    if (!citySlug) continue

    urls.push({
      loc: `${SITE_URL}/${citySlug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })

    for (const district of districts) {
      const districtSlug = getDistrictSlug(district)
      urls.push({
        loc: `${SITE_URL}/${citySlug}/${districtSlug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.7,
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]
  const urls: SitemapUrl[] = []

  // 홈페이지
  urls.push({ loc: SITE_URL, lastmod: today, changefreq: 'daily', priority: 1.0 })

  // 정적 페이지
  urls.push({ loc: `${SITE_URL}/about`, lastmod: today, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/faq`, lastmod: today, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/privacy`, lastmod: today, changefreq: 'monthly', priority: 0.3 })
  urls.push({ loc: `${SITE_URL}/terms`, lastmod: today, changefreq: 'monthly', priority: 0.3 })

  // /search는 noindex 페이지이므로 사이트맵에서 제외 (신호 충돌 방지)

  // 카테고리 랜딩 페이지
  for (const category of CATEGORIES) {
    urls.push({ loc: `${SITE_URL}/${category}`, lastmod: today, changefreq: 'daily', priority: 0.9 })
  }

  // 부동산 실거래가 페이지
  const propertyTypes = ['apt', 'villa', 'offitel']
  urls.push({ loc: `${SITE_URL}/real-estate`, lastmod: today, changefreq: 'daily', priority: 0.8 })
  for (const pt of propertyTypes) {
    urls.push({ loc: `${SITE_URL}/real-estate/${pt}`, lastmod: today, changefreq: 'daily', priority: 0.8 })
  }

  // 가이드 목록 페이지
  urls.push({ loc: `${SITE_URL}/guide`, lastmod: today, changefreq: 'daily', priority: 0.8 })

  // API base URL
  const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'

  // 가이드 개별 글
  try {
    const guidesRes = await fetch(`${apiBase}/api/guides?limit=100`)
    if (guidesRes.ok) {
      const guidesJson = await guidesRes.json()
      const guides: Array<{ slug: string; createdAt: string }> = guidesJson.data?.items || []
      for (const guide of guides) {
        const lastmod = guide.createdAt ? new Date(guide.createdAt).toISOString().split('T')[0] : today
        urls.push({ loc: `${SITE_URL}/guide/${guide.slug}`, lastmod, changefreq: 'weekly', priority: 0.7 })
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch guides:', err)
  }

  // API에서 실제 데이터가 있는 지역-카테고리 조합만 가져오기
  try {
    const res = await fetch(`${apiBase}/api/sitemap/region-categories`)
    if (res.ok) {
      const json = await res.json()
      const combinations: Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }> = json.data || []

      // 고유 도시, 도시+구군 조합 추출
      const citySet = new Set<string>()
      const districtSet = new Set<string>()
      const urlSet = new Set<string>()

      for (const combo of combinations) {
        if (!combo.citySlug || !combo.districtSlug) continue

        citySet.add(combo.citySlug)
        districtSet.add(`${combo.citySlug}/${combo.districtSlug}`)

        const loc = `${SITE_URL}/${combo.citySlug}/${combo.districtSlug}/${combo.category}`
        if (!urlSet.has(loc)) {
          urlSet.add(loc)
          urls.push({ loc, lastmod: today, changefreq: 'weekly', priority: 0.8 })
        }
      }

      // 도시 허브 페이지 (예: /seoul)
      Array.from(citySet).forEach((citySlug) => {
        urls.push({
          loc: `${SITE_URL}/${citySlug}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: 0.8,
        })
      })

      // 구/군 허브 페이지 (예: /seoul/gangnam)
      Array.from(districtSet).forEach((path) => {
        urls.push({
          loc: `${SITE_URL}/${path}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: 0.7,
        })
      })
    } else {
      console.error(`[sitemap] Failed to fetch region-categories: HTTP ${res.status}`)
      addFallbackHubPages(urls, today)
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch region-categories:', err)
    addFallbackHubPages(urls, today)
  }

  return generateSitemapXml(urls)
})
