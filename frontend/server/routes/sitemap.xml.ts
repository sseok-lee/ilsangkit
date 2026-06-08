// 사이트맵 인덱스 — /api/sitemap/page-counts 단일 호출로 페이지 수 계산.
// 카테고리 목록과 per-category limit 은 sitemapPolicy 를 단일 소스로 참조한다.
import { defineEventHandler, setHeader } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapIndexXml,
  fetchSitemapPageCounts,
  fetchFacilityIds,
  fetchWasteScheduleIds,
  fetchRealEstateBuildings,
  fetchSubscriptionIds,
  fetchSubwaySlugs,
  getWeekStartDate,
  fetchLandSitemap,
  fetchAuctionSitemap,
} from '../utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  getSitemapFacilityLimit,
} from '../utils/sitemapPolicy'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const weekStart = getWeekStartDate()

  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${SITE_URL}/sitemap/static.xml`, lastmod: today },
  ]

  // 단일 API 호출로 모든 카테고리 페이지 수 + lastmod 취득 (cold start ~1s)
  const pageCounts = await fetchSitemapPageCounts()

  if (pageCounts) {
    const realEstateLastmod = pageCounts.realEstateBuildings.maxUpdatedAt || today

    // real-estate hub (city/district listing pages)
    sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-hub.xml`, lastmod: realEstateLastmod })

    // 토지 실거래가 sitemap (hub + city + district always; dong only if isIndexable)
    sitemaps.push({ loc: `${SITE_URL}/sitemap/land.xml`, lastmod: weekStart })

    // real estate buildings
    const realEstatePages = Math.max(
      1,
      Math.ceil(pageCounts.realEstateBuildings.count / MAX_URLS_PER_SITEMAP)
    )
    if (realEstatePages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate.xml`, lastmod: realEstateLastmod })
    } else {
      for (let i = 1; i <= realEstatePages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-${i}.xml`, lastmod: realEstateLastmod })
      }
    }

    // subscriptions
    const subLastmod = pageCounts.subscriptions.maxUpdatedAt || today
    const subPages = Math.max(1, Math.ceil(pageCounts.subscriptions.count / MAX_URLS_PER_SITEMAP))
    if (subPages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/subscription.xml`, lastmod: subLastmod })
    } else {
      for (let i = 1; i <= subPages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/subscription-${i}.xml`, lastmod: subLastmod })
      }
    }

    // facility categories
    for (const { category, count, maxUpdatedAt } of pageCounts.facilities) {
      const lastmod = maxUpdatedAt || today
      const pages = Math.max(1, Math.ceil(count / MAX_URLS_PER_SITEMAP))
      if (pages === 1) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}.xml`, lastmod })
      } else {
        for (let i = 1; i <= pages; i++) {
          sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}-${i}.xml`, lastmod })
        }
      }
    }

    // trash (waste schedules)
    const trashLastmod = pageCounts.waste.maxUpdatedAt || today
    const trashPages = Math.max(1, Math.ceil(pageCounts.waste.count / MAX_URLS_PER_SITEMAP))
    if (trashPages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/trash.xml`, lastmod: trashLastmod })
    } else {
      for (let i = 1; i <= trashPages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/trash-${i}.xml`, lastmod: trashLastmod })
      }
    }
  } else {
    // fallback: 구 방식 (page-counts 엔드포인트 장애 시)
    sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-hub.xml`, lastmod: weekStart })

    // 토지 실거래가 sitemap (hub + city + district always; dong only if isIndexable)
    sitemaps.push({ loc: `${SITE_URL}/sitemap/land.xml`, lastmod: weekStart })

    const realEstateBuildings = await fetchRealEstateBuildings()
    const realEstatePages = Math.max(1, Math.ceil(realEstateBuildings.length / MAX_URLS_PER_SITEMAP))
    if (realEstatePages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate.xml`, lastmod: weekStart })
    } else {
      for (let i = 1; i <= realEstatePages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-${i}.xml`, lastmod: weekStart })
      }
    }

    const subscriptions = await fetchSubscriptionIds()
    const subLatestDate = subscriptions.reduce((max, item) => {
      const d = item.updatedAt?.split('T')[0]
      return d && d > max ? d : max
    }, '')
    const subLastmod = subLatestDate || today
    const subPages = Math.max(1, Math.ceil(subscriptions.length / MAX_URLS_PER_SITEMAP))
    if (subPages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/subscription.xml`, lastmod: subLastmod })
    } else {
      for (let i = 1; i <= subPages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/subscription-${i}.xml`, lastmod: subLastmod })
      }
    }

    const counts = await Promise.all(
      SITEMAP_FACILITY_CATEGORIES.map(async (cat) => {
        const items = await fetchFacilityIds(cat, getSitemapFacilityLimit(cat))
        const latestDate = items.reduce((max, item) => {
          const d = item.updatedAt?.split('T')[0]
          return d && d > max ? d : max
        }, '')
        return { category: cat, count: items.length, latestDate }
      })
    )
    for (const { category, count, latestDate } of counts) {
      const lastmod = latestDate || today
      const pages = Math.max(1, Math.ceil(count / MAX_URLS_PER_SITEMAP))
      if (pages === 1) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}.xml`, lastmod })
      } else {
        for (let i = 1; i <= pages; i++) {
          sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}-${i}.xml`, lastmod })
        }
      }
    }

    const trashItems = await fetchWasteScheduleIds()
    const trashLatestDate = trashItems.reduce((max, item) => {
      const d = item.updatedAt?.split('T')[0]
      return d && d > max ? d : max
    }, '')
    const trashLastmod = trashLatestDate || today
    const trashPages = Math.max(1, Math.ceil(trashItems.length / MAX_URLS_PER_SITEMAP))
    if (trashPages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/trash.xml`, lastmod: trashLastmod })
    } else {
      for (let i = 1; i <= trashPages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/trash-${i}.xml`, lastmod: trashLastmod })
      }
    }
  }

  // 지하철 — 약 1100개 항목으로 단일 청크. self-canonical + sitemap 등록으로 정식 색인 대상.
  try {
    const subwayItems = await fetchSubwaySlugs()
    if (subwayItems.length > 0) {
      const subwayLatestDate = subwayItems.reduce((max, item) => {
        const d = item.updatedAt?.split('T')[0]
        return d && d > max ? d : max
      }, '')
      const subwayLastmod = subwayLatestDate || today
      const subwayPages = Math.max(1, Math.ceil(subwayItems.length / MAX_URLS_PER_SITEMAP))
      if (subwayPages === 1) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/subway.xml`, lastmod: subwayLastmod })
      } else {
        for (let i = 1; i <= subwayPages; i++) {
          sitemaps.push({ loc: `${SITE_URL}/sitemap/subway-${i}.xml`, lastmod: subwayLastmod })
        }
      }
    }
  } catch (err) {
    console.error('[sitemap] subway index entry build failed:', err)
  }

  // 공매(온비드) — 색인 가능 항목이 있을 때만 추가
  try {
    const auctionData = await fetchAuctionSitemap()
    const hasAuctionUrls = auctionData.regions.some((r) => r.isIndexable) || auctionData.items.length > 0
    if (hasAuctionUrls) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/auction.xml`, lastmod: weekStart })
    }
  } catch (err) {
    console.error('[sitemap] auction index entry build failed:', err)
  }

  return generateSitemapIndexXml(sitemaps)
})
