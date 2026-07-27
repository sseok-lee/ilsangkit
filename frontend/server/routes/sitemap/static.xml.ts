// 정적 + 지역 조합 페이지 사이트맵
import { defineEventHandler, setHeader } from 'h3'
import { isRegenRequest, tryServeStaticSitemap } from '../../utils/sitemapStatic'
import { SITE_URL, generateSitemapXml } from '../../utils/sitemap'
import type { SitemapUrl } from '../../utils/sitemap'
import { CITY_SLUGS, DISTRICT_SLUG_MAP, REGIONS, getDistrictSlug } from '../../../shared/regionSlugs'
import { ssrFetch } from '../../utils/ssrFetch'

const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports']

// 안내·약관·소개 등 콘텐츠가 거의 변하지 않는 정적 페이지의 lastmod.
// Google 가이드: lastmod 는 "콘텐츠가 실제로 바뀐 시점" — 매 배포마다 today 로 갱신하면
// 신호 신뢰도가 떨어진다. 이 상수는 해당 페이지 본문이 실제 수정될 때만 함께 올린다.
const STATIC_PAGE_LASTMOD = '2026-04-01'

// Fallback: API 실패 시 도시/구군 허브 페이지만 추가 (빈 카테고리 조합은 제외)
function addFallbackHubPages(urls: SitemapUrl[], lastmod: string): void {
  for (const [cityName, districts] of Object.entries(REGIONS)) {
    const citySlug = CITY_SLUGS[cityName]
    if (!citySlug) continue

    urls.push({
      loc: `${SITE_URL}/${citySlug}`,
      lastmod,
      changefreq: 'weekly',
      priority: 0.8,
    })

    for (const district of districts) {
      const districtSlug = getDistrictSlug(district)
      urls.push({
        loc: `${SITE_URL}/${citySlug}/${districtSlug}`,
        lastmod,
        changefreq: 'weekly',
        priority: 0.7,
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  if (!isRegenRequest(event)) {
    const cached = await tryServeStaticSitemap(event)
    if (cached !== null) return cached
  }

  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]
  // 도시/구군 허브 페이지는 카테고리 sync 와 무관한 집계 페이지라 weekly bucket 로 안정화.
  const weekStart = (() => {
    const d = new Date()
    const day = d.getUTCDay()
    const diff = (day + 6) % 7 // 월요일 기준
    d.setUTCDate(d.getUTCDate() - diff)
    return d.toISOString().split('T')[0]
  })()
  const urls: SitemapUrl[] = []

  const categoryLastmodMap = new Map<string, string>()
  let subscriptionLastmod = weekStart
  try {
    const json = await ssrFetch<{
      data?: {
        facilities?: Array<{ category: string; maxUpdatedAt: string | null }>
        subscriptions?: { maxUpdatedAt: string | null }
      }
    }>('/api/sitemap/page-counts')
    const facilities: Array<{ category: string; maxUpdatedAt: string | null }> =
      json.data?.facilities ?? []
    for (const f of facilities) {
      if (f.maxUpdatedAt) categoryLastmodMap.set(f.category, f.maxUpdatedAt)
    }
    const subMax = json.data?.subscriptions?.maxUpdatedAt
    if (subMax) subscriptionLastmod = subMax
  } catch (err) {
    console.error('[sitemap/static] Failed to fetch page-counts:', err)
  }

  // 홈페이지 — 청약 + 부동산 + 시설 다 노출되므로 데이터 변경 빈도가 가장 높음
  urls.push({ loc: SITE_URL, lastmod: today, changefreq: 'daily', priority: 1.0 })

  // 정적 페이지 — 콘텐츠 변경 시에만 STATIC_PAGE_LASTMOD 상수 갱신
  urls.push({ loc: `${SITE_URL}/about`, lastmod: STATIC_PAGE_LASTMOD, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/faq`, lastmod: STATIC_PAGE_LASTMOD, changefreq: 'monthly', priority: 0.5 })
  urls.push({ loc: `${SITE_URL}/contact`, lastmod: STATIC_PAGE_LASTMOD, changefreq: 'monthly', priority: 0.4 })
  urls.push({ loc: `${SITE_URL}/privacy`, lastmod: STATIC_PAGE_LASTMOD, changefreq: 'monthly', priority: 0.3 })
  urls.push({ loc: `${SITE_URL}/terms`, lastmod: STATIC_PAGE_LASTMOD, changefreq: 'monthly', priority: 0.3 })

  // /search는 noindex 페이지이므로 사이트맵에서 제외 (신호 충돌 방지)

  // 카테고리 랜딩 페이지 — 실제 sync 시점 (없으면 weekStart fallback)
  for (const category of CATEGORIES) {
    const lastmod = categoryLastmodMap.get(category) ?? weekStart
    urls.push({ loc: `${SITE_URL}/${category}`, lastmod, changefreq: 'daily', priority: 0.9 })
  }

  // 부동산 실거래가 페이지 — 거래 데이터는 주 단위 sync (weekStart)
  const hubTypes = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']
  urls.push({ loc: `${SITE_URL}/real-estate`, lastmod: weekStart, changefreq: 'daily', priority: 0.8 })
  for (const pt of hubTypes) {
    urls.push({ loc: `${SITE_URL}/real-estate/${pt}`, lastmod: weekStart, changefreq: 'daily', priority: 0.8 })
  }

  // 청약 페이지 — Subscription 모델 maxUpdatedAt
  urls.push({ loc: `${SITE_URL}/subscription`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.8 })
  urls.push({ loc: `${SITE_URL}/subscription/sale`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.8 })
  urls.push({ loc: `${SITE_URL}/subscription/sale/apt`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/subscription/sale/offitel`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/subscription/sale/remaining`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/subscription/sale/optional`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/subscription/rent`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.8 })
  urls.push({ loc: `${SITE_URL}/subscription/rent/public`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/subscription/rent/private`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })

  // 가이드 목록 페이지 — 가이드 추가 빈도 따라감 (today 유지: 신규 가이드가 자주 올라옴)
  urls.push({ loc: `${SITE_URL}/guide`, lastmod: today, changefreq: 'daily', priority: 0.8 })

  // 가이드 개별 글 — 백엔드가 페이지당 최대 100건만 반환하므로 totalPages 까지 순차 수집.
  // 100건 하드 캡을 제거해 가이드 수가 늘어나도 sitemap 에서 누락되지 않게 한다.
  try {
    const MAX_GUIDE_PAGES = 50 // 총 5000 건까지 안전 가드 — 실운영에서는 훨씬 적음
    for (let page = 1; page <= MAX_GUIDE_PAGES; page++) {
      let guidesJson: {
        data?: {
          items?: Array<{ slug: string; createdAt: string; publishedAt?: string | null }>
          totalPages?: number
        }
      } | null = null
      try {
        guidesJson = await ssrFetch(`/api/guides?limit=100&page=${page}`)
      } catch (err) {
        console.error(`[sitemap] Failed to fetch guides page=${page}:`, err)
        break
      }
      const guides: Array<{ slug: string; createdAt: string; publishedAt?: string | null }> = guidesJson?.data?.items ?? []
      for (const guide of guides) {
        // article 블록과 동일하게 발행일 기준. createdAt 은 초안 작성일이라
        // 상세 페이지 JSON-LD(datePublished=publishedAt)·RSS 와 날짜가 어긋난다.
        const publishedAt = guide.publishedAt || guide.createdAt
        const lastmod = publishedAt ? new Date(publishedAt).toISOString().split('T')[0] : today
        urls.push({ loc: `${SITE_URL}/guide/${guide.slug}`, lastmod, changefreq: 'weekly', priority: 0.7 })
      }
      const totalPages = Number(guidesJson?.data?.totalPages ?? 1)
      if (page >= totalPages || guides.length === 0) break
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch guides:', err)
  }

  // 오늘의 이슈(article) 목록 페이지 — 발행 article 추가 빈도 따라감
  urls.push({ loc: `${SITE_URL}/article`, lastmod: today, changefreq: 'daily', priority: 0.7 })

  // 오늘의 이슈(article) 개별 글 — 공개 API는 published 만 반환.
  // 백엔드가 페이지당 최대 100건만 반환하므로 totalPages 까지 순차 수집 (guide 루프와 동일 구조).
  try {
    const MAX_ARTICLE_PAGES = 50 // 총 5000 건까지 안전 가드 — 실운영에서는 훨씬 적음
    for (let page = 1; page <= MAX_ARTICLE_PAGES; page++) {
      let articlesJson: {
        data?: {
          items?: Array<{ slug: string; publishedAt: string | null }>
          totalPages?: number
        }
      } | null = null
      try {
        articlesJson = await ssrFetch(`/api/articles?limit=100&page=${page}`)
      } catch (err) {
        console.error(`[sitemap] Failed to fetch articles page=${page}:`, err)
        break
      }
      const articles: Array<{ slug: string; publishedAt: string | null }> = articlesJson?.data?.items ?? []
      for (const article of articles) {
        const lastmod = article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : today
        urls.push({ loc: `${SITE_URL}/article/${article.slug}`, lastmod, changefreq: 'weekly', priority: 0.7 })
      }
      const totalPages = Number(articlesJson?.data?.totalPages ?? 1)
      if (page >= totalPages || articles.length === 0) break
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch articles:', err)
  }

  // API에서 실제 데이터가 있는 지역-카테고리 조합만 가져오기
  try {
    const json = await ssrFetch<{
      data?: Array<{
        city: string
        district: string
        citySlug: string
        districtSlug: string
        category: string
      }>
    }>('/api/sitemap/region-categories')

    const combinations = json.data ?? []

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
        // 카테고리별 sync 시점이 있으면 사용, 없으면 weekly bucket
        const lastmod = categoryLastmodMap.get(combo.category) ?? weekStart
        urls.push({ loc, lastmod, changefreq: 'weekly', priority: 0.8 })
      }
    }

    // 도시 허브 페이지 (예: /seoul) — 주 단위 집계
    Array.from(citySet).forEach((citySlug) => {
      urls.push({
        loc: `${SITE_URL}/${citySlug}`,
        lastmod: weekStart,
        changefreq: 'weekly',
        priority: 0.8,
      })
    })

    // 구/군 허브 페이지 (예: /seoul/gangnam)
    Array.from(districtSet).forEach((path) => {
      urls.push({
        loc: `${SITE_URL}/${path}`,
        lastmod: weekStart,
        changefreq: 'weekly',
        priority: 0.7,
      })
    })

    // /{city}/{district}/real-estate 는 [category].vue 화이트리스트 밖이라 404.
    // 부동산 hub URL 은 /sitemap/real-estate-hub.xml 에서 별도 발행.
  } catch (err) {
    console.error('[sitemap] Failed to fetch region-categories:', err)
    addFallbackHubPages(urls, weekStart)
  }

  return generateSitemapXml(urls)
})
