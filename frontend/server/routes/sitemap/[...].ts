// catch-all 동적 카테고리 사이트맵 — Nitro가 [slug].xml.ts를 인식 못하는 문제 우회.
// 카테고리 목록과 per-category limit 은 sitemapPolicy 를 단일 소스로 참조해
// 인덱스(sitemap.xml.ts)와 완전히 동일한 청크 구성을 반환한다.
import { defineEventHandler, setHeader, setResponseStatus, type H3Event } from 'h3'
import { isRegenRequest, tryServeStaticSitemap } from '../../utils/sitemapStatic'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapXml,
  formatDateForSitemap,
  fetchFacilityIds,
  fetchWasteScheduleRegions,
  fetchRealEstateBuildings,
  fetchRealEstateCityDistrictHubs,
  fetchLandSitemap,
  fetchAuctionSitemap,
  fetchSubscriptionIds,
  fetchSubwaySlugs,
  getWeekStartDate,
} from '../../utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  getSitemapFacilityLimit,
  isSitemapFacilityCategory,
} from '../../utils/sitemapPolicy'
import { toAbsoluteRealEstateUrl, toCitySlugByDistrict, toDistrictSlug, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { buildTrashRegionPath } from '~/shared/regionSlugs'

// wifi는 noindex-only 상세 정책에 따라 사이트맵 인덱스에서 제외된 카테고리다.
// 동적 핸들러에서도 제외하여 sitemap URL은 404를 반환한다.
// AED는 색인 대상이므로 sitemapPolicy 에 포함해 chunk sitemap 을 제공한다.
const FACILITY_CATEGORIES = new Set<string>(SITEMAP_FACILITY_CATEGORIES)

function parseSlug(slug: string): { category: string; page: number } | null {
  // "real-estate-hub" → city/district hub sitemap (no pagination)
  if (slug === 'real-estate-hub') {
    return { category: 'real-estate-hub', page: 1 }
  }

  // "land" → 토지 실거래가 사이트맵 (no pagination)
  if (slug === 'land') {
    return { category: 'land', page: 1 }
  }

  // "auction" → 공매 사이트맵 (no pagination)
  if (slug === 'auction') {
    return { category: 'auction', page: 1 }
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

/**
 * `.xml` 요청의 오류 응답 본문.
 *
 * 종전에는 createError 로 던져 Nuxt 에러 페이지(HTML 약 26KB)가 렌더됐다. 크롤러는 XML 을
 * 요청하고 26KB HTML 을 받았고, 일 수집량이 33,000 → 3,000 으로 무너진 상태에서 존재하지도
 * 않는 청크 하나가 정상 사이트맵 한 편만큼의 크롤 예산을 먹었다.
 * 상태코드 의미는 그대로 두고 본문만 최소 XML 로 바꾼다.
 */
function sitemapErrorXml(event: H3Event, statusCode: number, reason: string): string {
  setResponseStatus(event, statusCode)
  setHeader(event, 'Content-Type', 'application/xml')
  // 빈/오류 응답이 캐시되거나 디스크로 구워지지 않게 한다.
  // generateSitemaps 는 non-2xx 자식을 직전 생성본으로 이월하므로 이 헤더가 안전판이다.
  setHeader(event, 'cache-control', 'no-store')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${reason} -->\n`
}

/** 인덱스가 광고하지 않는 청크 번호·카테고리. 구조적 404 라 재시도 유도 대상이 아니다. */
function sitemapNotFound(event: H3Event): string {
  return sitemapErrorXml(event, 404, 'sitemap chunk not found')
}

/**
 * page 1 이 0건이면 상류(백엔드 집계 API) 장애다 — fail-closed.
 *
 * 종전에는 `length === 0 && page > 1` 만 503 이라 page 1 은 그대로 빠져나갔다.
 * items 0건 → `totalPages = Math.max(1, 0) = 1` → `page > totalPages` 가 거짓 → 형식은
 * 멀쩡한 **빈 `<urlset>`** 이 200 으로 나갔고, 정적 baker 가 그걸 디스크에 구워 빈 상태를
 * 동결시켰다. 그 뒤로는 크롤러가 "이 카테고리엔 URL 이 없다"를 계속 확인만 하게 된다.
 * 503 + no-store 면 아무것도 캐시·베이크되지 않고 직전 생성본이 이월된다.
 */
function sitemapUpstreamUnavailable(event: H3Event, what: string): string {
  return sitemapErrorXml(event, 503, `upstream empty: ${what}`)
}

export default defineEventHandler(async (event) => {
  if (!isRegenRequest(event)) {
    const cached = await tryServeStaticSitemap(event)
    if (cached !== null) return cached
  }

  // URL path에서 slug 추출 (쿼리 제거 방어). /sitemap/wifi-1.xml → wifi-1
  const path = (event.path || '').split('?')[0]
  const lastSegment = path.split('/').pop() || ''

  // .xml 확장자 필수
  if (!lastSegment.endsWith('.xml')) {
    return sitemapNotFound(event)
  }

  const slug = lastSegment.replace(/\.xml$/, '')
  if (!slug) {
    return sitemapNotFound(event)
  }

  const parsed = parseSlug(slug)
  if (!parsed) {
    return sitemapNotFound(event)
  }

  const { category, page } = parsed

  setHeader(event, 'Content-Type', 'application/xml')

  // 부동산 건물 상세 페이지
  if (category === 'real-estate') {
    // 서버가 청크 단위로만 돌려준다 — 전량(50.8MB)을 받아 slice 하면 백엔드 메모리가
    // +275MB 튀어 PM2 재시작을 유발한다(2026-07-28 실측).
    const { items: pageItems, total } = await fetchRealEstateBuildings(page)
    if (pageItems.length === 0) {
      return sitemapUpstreamUnavailable(event, 'real-estate-buildings')
    }
    const totalPages = Math.max(1, Math.ceil(total / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      return sitemapNotFound(event)
    }

    const weekStart = getWeekStartDate()

    const urls = pageItems.map((item) => ({
      loc: toAbsoluteRealEstateUrl(SITE_URL, {
        type: item.realEstateType as RealEstateUrlType,
        city: item.city,
        district: item.district,
        buildingName: item.buildingName,
      }),
      // 건물별 최근 실거래월(진짜 freshness). 백엔드 미배포/구버전 응답 시 weekStart 폴백.
      lastmod: item.lastmod || weekStart,
    }))

    return generateSitemapXml(urls)
  }

  // 부동산 city/district 허브 페이지
  if (category === 'real-estate-hub') {
    const hubs = await fetchRealEstateCityDistrictHubs()
    // 허브는 늘 수백 건이다. 0건 = 상류 장애 — 빈 urlset 을 200 으로 구워두면 안 된다.
    if (hubs.length === 0) {
      return sitemapUpstreamUnavailable(event, 'real-estate-hubs')
    }
    const weekStart = getWeekStartDate()

    const seenCityUrls = new Set<string>()
    const urls: Parameters<typeof generateSitemapXml>[0] = []

    for (const hub of hubs) {
      const citySlug = toCitySlugByDistrict(hub.city, hub.district)
      const districtSlug = toDistrictSlug(hub.district)

      const cityUrl = `${SITE_URL}/real-estate/${hub.realEstateType}/${citySlug}`
      if (!seenCityUrls.has(cityUrl)) {
        seenCityUrls.add(cityUrl)
        urls.push({ loc: cityUrl, lastmod: weekStart })
      }

      const districtUrl = `${SITE_URL}/real-estate/${hub.realEstateType}/${citySlug}/${districtSlug}`
      urls.push({ loc: districtUrl, lastmod: weekStart })
    }

    return generateSitemapXml(urls)
  }

  // 토지 실거래가 — hub + city + district 항상 포함, 동(dong)은 isIndexable=true인 것만 포함
  if (category === 'land') {
    const { cities, indexableDongs, ok } = await fetchLandSitemap()
    // 이 분기는 상류 결과와 무관하게 허브 URL 을 먼저 push 하므로 urls.length 가 0 이 되지
    // 않는다. 다른 분기가 쓰는 `length === 0` 검사가 여기선 영원히 거짓이라, 상류가 죽어도
    // URL 1개짜리 사이트맵이 200 으로 나가 디스크에 구워졌다. 실패는 실패로 응답한다.
    if (ok === false) {
      return sitemapUpstreamUnavailable(event, 'land')
    }
    const weekStart = getWeekStartDate()

    const urls: Parameters<typeof generateSitemapXml>[0] = []

    // hub
    urls.push({ loc: `${SITE_URL}/real-estate/land`, lastmod: weekStart })

    // city + district (always included)
    const seenCityUrls = new Set<string>()
    for (const { city, district } of cities) {
      const citySlug = toCitySlugByDistrict(city, district)
      const districtSlug = toDistrictSlug(district)
      const cityUrl = `${SITE_URL}/real-estate/land/${citySlug}`
      if (!seenCityUrls.has(cityUrl)) {
        seenCityUrls.add(cityUrl)
        urls.push({ loc: cityUrl, lastmod: weekStart })
      }
      urls.push({ loc: `${SITE_URL}/real-estate/land/${citySlug}/${districtSlug}`, lastmod: weekStart })
    }

    // dong URLs — only isIndexable=true (quality gate)
    for (const { city, district, dongName } of indexableDongs) {
      urls.push({
        loc: `${SITE_URL}/real-estate/land/${toCitySlugByDistrict(city, district)}/${toDistrictSlug(district)}/${encodeURIComponent(dongName)}`,
        lastmod: weekStart,
      })
    }

    return generateSitemapXml(urls)
  }

  // 공매(온비드) — 색인 가능 시군구 + 물건 상세
  if (category === 'auction') {
    const { regions, items, ok } = await fetchAuctionSitemap()
    // land 와 같은 이유 — 허브 URL 을 먼저 push 해서 length 검사가 무력하다.
    if (ok === false) {
      return sitemapUpstreamUnavailable(event, 'auction')
    }
    const weekStart = getWeekStartDate()

    const urls: Parameters<typeof generateSitemapXml>[0] = []

    // hub
    urls.push({ loc: `${SITE_URL}/auction`, lastmod: weekStart })

    // indexable region pages (dedupe to unique city/district)
    //
    // isIndexable 재검사를 하지 않는다. 백엔드 getSitemapEntries 가 이미
    // `where: { isIndexable: true }` 로 거른 뒤 select 에서 그 컬럼을 빼고 돌려주기 때문에,
    // 프론트에서 `if (!region.isIndexable) continue` 를 걸면 **모든 행이 undefined 라 전부
    // 탈락**했다. 그래서 /sitemap/auction.xml 에는 /auction/{city}/{district} 가 0건이었다
    // (페이지 자체는 색인 가능하게 렌더되는데도). 게이트를 한 겹 더 쌓는 대신 이미 게이트를
    // 통과한 페이로드를 그대로 신뢰한다 — 백엔드 select 에 컬럼을 추가하는 건 이 그룹의
    // 소유 파일 밖이고, 이중 게이트는 다시 어긋날 수 있다.
    const seenRegionUrls = new Set<string>()
    for (const region of regions) {
      const citySlug = toCitySlugByDistrict(region.city, region.district)
      const districtSlug = toDistrictSlug(region.district)
      const regionUrl = `${SITE_URL}/auction/${citySlug}/${districtSlug}`
      if (!seenRegionUrls.has(regionUrl)) {
        seenRegionUrls.add(regionUrl)
        urls.push({ loc: regionUrl, lastmod: weekStart })
      }
    }

    // item pages
    for (const cltrMngNo of items) {
      urls.push({ loc: `${SITE_URL}/auction/item/${cltrMngNo}`, lastmod: weekStart })
    }

    return generateSitemapXml(urls)
  }

  // 지하철역 SEO 페이지 — self-canonical + sitemap 등록으로 정식 색인 대상
  if (category === 'subway') {
    const stations = await fetchSubwaySlugs()
    if (stations.length === 0) {
      return sitemapUpstreamUnavailable(event, 'subway-stations')
    }
    const totalPages = Math.max(1, Math.ceil(stations.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      return sitemapNotFound(event)
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = stations.slice(offset, offset + MAX_URLS_PER_SITEMAP)

    const urls = pageItems.map((item) => ({
      loc: `${SITE_URL}/subway/${item.slug}`,
      lastmod: formatDateForSitemap(item.updatedAt),
    }))

    return generateSitemapXml(urls)
  }

  // 청약 일정 상세 페이지
  if (category === 'subscription') {
    const subscriptions = await fetchSubscriptionIds()
    if (subscriptions.length === 0) {
      return sitemapUpstreamUnavailable(event, 'subscriptions')
    }
    const totalPages = Math.max(1, Math.ceil(subscriptions.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      return sitemapNotFound(event)
    }

    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    const pageItems = subscriptions.slice(offset, offset + MAX_URLS_PER_SITEMAP)

    const urls = pageItems.map((item) => ({
      loc: `${SITE_URL}/subscription/${item.id}`,
      lastmod: formatDateForSitemap(item.updatedAt),
    }))

    return generateSitemapXml(urls)
  }

  // 쓰레기 배출(trash) — 개별 /trash/[id] 대신 구·군 집계 URL 사이트맵.
  // buildTrashRegionPath 출력이 개별 상세의 301 타겟·집계 페이지 canonical과 byte-match 되어야 한다.
  if (category === 'trash') {
    const regions = await fetchWasteScheduleRegions()
    // API 실패로 데이터 없음 — 503으로 크롤러 재시도 유도 (빈 sitemap 캐시·베이크 방지)
    if (regions.length === 0) {
      return sitemapUpstreamUnavailable(event, 'waste-schedule-regions')
    }

    const seen = new Set<string>()
    const urls: Parameters<typeof generateSitemapXml>[0] = []
    for (const r of regions) {
      const regionPath = buildTrashRegionPath(r.city, r.district)
      if (!regionPath || seen.has(regionPath)) continue
      seen.add(regionPath)
      urls.push({
        loc: `${SITE_URL}${regionPath}`,
        lastmod: formatDateForSitemap(r.updatedAt),
      })
    }

    // region 수(~250)는 MAX_URLS_PER_SITEMAP 이하라 단일 청크. page>totalPages 404 유지.
    const totalPages = Math.max(1, Math.ceil(urls.length / MAX_URLS_PER_SITEMAP))
    if (page > totalPages) {
      return sitemapNotFound(event)
    }
    const offset = (page - 1) * MAX_URLS_PER_SITEMAP
    return generateSitemapXml(urls.slice(offset, offset + MAX_URLS_PER_SITEMAP))
  }

  // 시설 카테고리 — 인덱스와 동일한 limit을 적용해 청크 수가 어긋나지 않게 한다
  const items = await fetchFacilityIds(
    category,
    isSitemapFacilityCategory(category) ? getSitemapFacilityLimit(category) : undefined,
  )

  // API 실패로 데이터 없음 — 503으로 크롤러 재시도 유도 (빈 sitemap 캐시·베이크 방지)
  if (items.length === 0) {
    return sitemapUpstreamUnavailable(event, `facilities/${category}`)
  }
  // totalPages 는 게이트 적용 전 원본 건수로 센다 — 인덱스(sitemap.xml)가 백엔드 count 로
  // 광고하는 청크 수와 어긋나면 존재하지 않는 청크가 인덱스에 남는다.
  const totalPages = Math.max(1, Math.ceil(items.length / MAX_URLS_PER_SITEMAP))
  if (page > totalPages) {
    return sitemapNotFound(event)
  }

  // slice로 해당 페이지 항목 추출
  const offset = (page - 1) * MAX_URLS_PER_SITEMAP
  const pageItems = items.slice(offset, offset + MAX_URLS_PER_SITEMAP)

  const urls = pageItems.map((item) => ({
    loc: `${SITE_URL}/${category}/${item.id}`,
    lastmod: formatDateForSitemap(item.updatedAt),
  }))

  return generateSitemapXml(urls)
})
