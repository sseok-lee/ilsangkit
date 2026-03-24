// 사이트맵 인덱스 — 각 카테고리의 URL 수에 따라 자동 분할
import { defineEventHandler, setHeader } from 'h3'
import {
  SITE_URL,
  MAX_URLS_PER_SITEMAP,
  generateSitemapIndexXml,
  fetchFacilityIds,
  fetchWasteScheduleIds,
  fetchRealEstateBuildings,
} from '../utils/sitemap'

// 검색 트렌드 기반 사이트맵 포함 카테고리 (2026-03 네이버 데이터랩 분석)
// 제외: wifi (90K URL, 검색수요 낮음), aed (70K URL, 검색수요 최하위)
// → 82만→약 66만 URL 감소. 내부 링크로 발견 가능하므로 색인에는 영향 없음
const FACILITY_CATEGORIES = ['toilet', 'clothes', 'parking', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'] as const

// 크롤 예산 절감을 위한 카테고리별 URL 수 제한
const FACILITY_CATEGORY_LIMITS: Partial<Record<string, number>> = {
  'ev-charger': 20000,  // ~100K → 20K
  'childcare': 15000,   // ~60K → 15K
  'sports': 10000,      // ~40K → 10K
}

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
    FACILITY_CATEGORIES.map(async (cat) => {
      const items = await fetchFacilityIds(cat, apiBase, FACILITY_CATEGORY_LIMITS[cat])
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

  // 부동산 건물 상세 페이지
  const realEstateBuildings = await fetchRealEstateBuildings(apiBase)
  const realEstatePages = Math.max(1, Math.ceil(realEstateBuildings.length / MAX_URLS_PER_SITEMAP))
  if (realEstatePages === 1) {
    sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate.xml`, lastmod: today })
  } else {
    for (let i = 1; i <= realEstatePages; i++) {
      sitemaps.push({ loc: `${SITE_URL}/sitemap/real-estate-${i}.xml`, lastmod: today })
    }
  }

  return generateSitemapIndexXml(sitemaps)
})
