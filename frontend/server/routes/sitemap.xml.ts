// 사이트맵 인덱스 — 각 카테고리의 URL 수에 따라 자동 분할.
// 카테고리 목록과 per-category limit 은 sitemapPolicy 를 단일 소스로 참조한다.
import { defineEventHandler, setHeader } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapIndexXml,
  fetchFacilityIds,
  fetchWasteScheduleIds,
  fetchRealEstateBuildings,
  fetchSubscriptionIds,
  getWeekStartDate,
} from '../utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  getSitemapFacilityLimit,
} from '../utils/sitemapPolicy'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const today = new Date().toISOString().split('T')[0]

  // static.xml은 항상 1개
  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${SITE_URL}/sitemap/static.xml`, lastmod: today },
  ]

  // 시설 카테고리별 count 조회 → 페이지 수 계산 + 최신 updatedAt 추출
  const counts = await Promise.all(
    SITEMAP_FACILITY_CATEGORIES.map(async (cat) => {
      const items = await fetchFacilityIds(cat, apiBase, getSitemapFacilityLimit(cat))
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

  // trash (waste schedules)
  const trashItems = await fetchWasteScheduleIds(apiBase)
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

  // 청약 상세 페이지
  const subscriptions = await fetchSubscriptionIds(apiBase)
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

  // 부동산 건물 상세 페이지 — lastmod는 주 단위로 설정 (매일 변경 방지)
  const realEstateBuildings = await fetchRealEstateBuildings(apiBase)
  const weekStart = getWeekStartDate()
  const realEstatePages = Math.max(1, Math.ceil(realEstateBuildings.length / MAX_URLS_PER_SITEMAP))
  if (realEstatePages === 1) {
    sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate.xml`, lastmod: weekStart })
  } else {
    for (let i = 1; i <= realEstatePages; i++) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-${i}.xml`, lastmod: weekStart })
    }
  }

  return generateSitemapIndexXml(sitemaps)
})
