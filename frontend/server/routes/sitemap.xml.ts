// 사이트맵 인덱스 — 각 카테고리의 URL 수에 따라 자동 분할
import { defineEventHandler, setHeader } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapIndexXml,
  fetchFacilityIds,
  fetchWasteScheduleIds,
} from '../utils/sitemap'

const FACILITY_CATEGORIES = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy'] as const

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const today = new Date().toISOString().split('T')[0]

  // static.xml은 항상 1개
  const sitemaps: { loc: string; lastmod: string }[] = [
    { loc: `${SITE_URL}/sitemap/static.xml`, lastmod: today },
  ]

  // 시설 카테고리별 count 조회 → 페이지 수 계산
  const counts = await Promise.all(
    FACILITY_CATEGORIES.map(async (cat) => {
      const items = await fetchFacilityIds(cat, apiBase)
      return { category: cat, count: items.length }
    })
  )

  for (const { category, count } of counts) {
    const pages = Math.max(1, Math.ceil(count / MAX_URLS_PER_SITEMAP))
    if (pages === 1) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}.xml`, lastmod: today })
    } else {
      for (let i = 1; i <= pages; i++) {
        sitemaps.push({ loc: `${SITE_URL}/sitemap/${category}-${i}.xml`, lastmod: today })
      }
    }
  }

  // trash (waste schedules)
  const trashItems = await fetchWasteScheduleIds(apiBase)
  const trashPages = Math.max(1, Math.ceil(trashItems.length / MAX_URLS_PER_SITEMAP))
  if (trashPages === 1) {
    sitemaps.push({ loc: `${SITE_URL}/sitemap/trash.xml`, lastmod: today })
  } else {
    for (let i = 1; i <= trashPages; i++) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/trash-${i}.xml`, lastmod: today })
    }
  }

  return generateSitemapIndexXml(sitemaps)
})
