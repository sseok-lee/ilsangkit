import { isValidBuildingName } from '../../utils/realEstateBuildingName'
import { ssrFetch } from './ssrFetch'

export const SITE_URL = 'https://ilsangkit.co.kr'

export const MAX_URLS_PER_SITEMAP = 10_000

export interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  image?: {
    loc: string
    title?: string
    caption?: string
  }
}

interface SitemapIndexEntry {
  loc: string
  lastmod?: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateSitemapXml(urls: SitemapUrl[]): string {
  const hasImages = urls.some((url) => url.image !== undefined)
  const imageNs = hasImages
    ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
    : ''

  const urlElements = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`]
      if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`)
      if (url.changefreq) parts.push(`    <changefreq>${url.changefreq}</changefreq>`)
      if (url.priority !== undefined) parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`)
      if (url.image) {
        const imgParts = [`      <image:loc>${escapeXml(url.image.loc)}</image:loc>`]
        if (url.image.title) imgParts.push(`      <image:title>${escapeXml(url.image.title)}</image:title>`)
        if (url.image.caption) imgParts.push(`      <image:caption>${escapeXml(url.image.caption)}</image:caption>`)
        parts.push(`    <image:image>\n${imgParts.join('\n')}\n    </image:image>`)
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>
${urlElements}
</urlset>`
}

export function generateSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const entries = sitemaps
    .map((s) => {
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`]
      if (s.lastmod) parts.push(`    <lastmod>${s.lastmod}</lastmod>`)
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`
}

// KST(Asia/Seoul) 기준 YYYY-MM-DD 변환.
// DB는 UTC 저장이라 toISOString()을 그대로 split 하면 KST 새벽 시간대(00:00~08:59)는
// 어제 날짜로 표시되는 문제가 있어 KST로 변환 후 추출한다.
export function formatDateForSitemap(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

// 캐시: 카테고리별 ID 목록을 10분간 메모리에 보관
const cache = new Map<string, { data: unknown[]; expires: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10분

function getCached<T>(key: string): T[] | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data as T[]
}

function setCache(key: string, data: unknown[]): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL })
}

export async function fetchFacilityIds(
  category: string,
  limit?: number
): Promise<{ id: string; updatedAt: string }[]> {
  const cacheKey = `facility:${category}${limit !== undefined ? `:limit${limit}` : ''}`
  const cached = getCached<{ id: string; updatedAt: string }>(cacheKey)
  if (cached) return cached

  const path = limit !== undefined
    ? `/api/sitemap/facilities/${category}?limit=${limit}`
    : `/api/sitemap/facilities/${category}`

  try {
    const json = await ssrFetch<{ data?: { id: string; updatedAt: string }[] }>(path, {
      timeoutMs: 25_000,
    })
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error(`[sitemap] fetchFacilityIds(${category}) failed`, err)
    return []
  }
}

export async function fetchWasteScheduleIds(): Promise<{ id: number; updatedAt: string }[]> {
  const cacheKey = 'waste-schedules'
  const cached = getCached<{ id: number; updatedAt: string }>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: { id: number; updatedAt: string }[] }>(
      '/api/sitemap/waste-schedules',
      { timeoutMs: 25_000 },
    )
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchWasteScheduleIds failed', err)
    return []
  }
}

export interface SitemapRealEstateBuilding {
  realEstateType: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
  city: string
  district: string
  buildingName: string
  bjdCode: string
}

export async function fetchRealEstateBuildings(): Promise<SitemapRealEstateBuilding[]> {
  const cacheKey = 'real-estate-buildings'
  const cached = getCached<SitemapRealEstateBuilding>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: SitemapRealEstateBuilding[] }>(
      '/api/sitemap/real-estate-buildings',
      { timeoutMs: 25_000 },
    )
    const raw = json.data ?? []
    const data = raw.filter((item) => isValidBuildingName(item.buildingName))
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRealEstateBuildings failed', err)
    return []
  }
}

export function getWeekStartDate(): string {
  // KST 기준 이번 주 월요일을 YYYY-MM-DD로 반환.
  const now = new Date()
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = kstNow.getDay()
  const diff = kstNow.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(kstNow)
  monday.setDate(diff)
  return monday.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export interface SitemapRealEstateHub {
  realEstateType: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
  city: string
  district: string
}

export async function fetchRealEstateCityDistrictHubs(): Promise<SitemapRealEstateHub[]> {
  const cacheKey = 'real-estate-hubs'
  const cached = getCached<SitemapRealEstateHub>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: SitemapRealEstateHub[] }>(
      '/api/sitemap/real-estate-hubs',
      { timeoutMs: 25_000 },
    )
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRealEstateCityDistrictHubs failed', err)
    return []
  }
}

export async function fetchRegionCategories(): Promise<
  Array<{ city: string; district: string; category: string }>
> {
  const cacheKey = 'region-categories'
  const cached = getCached<{ city: string; district: string; category: string }>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{
      data?: Array<{ city: string; district: string; category: string }>
    }>('/api/sitemap/region-categories', { timeoutMs: 25_000 })
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRegionCategories failed', err)
    return []
  }
}

export interface SitemapPageCounts {
  facilities: Array<{ category: string; count: number; maxUpdatedAt: string | null }>
  waste: { count: number; maxUpdatedAt: string | null }
  subscriptions: { count: number; maxUpdatedAt: string | null }
  realEstateBuildings: { count: number; maxUpdatedAt: string | null }
}

export async function fetchSitemapPageCounts(): Promise<SitemapPageCounts | null> {
  try {
    const json = await ssrFetch<{ data?: SitemapPageCounts }>('/api/sitemap/page-counts', {
      timeoutMs: 25_000,
    })
    return json.data ?? null
  } catch (err) {
    console.error('[sitemap] fetchSitemapPageCounts failed', err)
    return null
  }
}

export async function fetchSubwaySlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const cacheKey = 'subway-slugs'
  const cached = getCached<{ slug: string; updatedAt: string }>(cacheKey)
  if (cached) return cached

  try {
    // grouped=true → nameSlug 단위 distinct 응답. 환승역 중복 방지.
    const json = await ssrFetch<{
      data?: { items?: Array<{ nameSlug: string; updatedAt: string }> }
    }>('/api/subway/stations?limit=5000&grouped=true', { timeoutMs: 25_000 })
    const items = json?.data?.items ?? []
    const data = items.map((s) => ({
      slug: s.nameSlug,
      updatedAt: s.updatedAt,
    }))
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchSubwaySlugs failed', err)
    return []
  }
}

export interface LandSitemapData {
  cities: Array<{ city: string; district: string }>
  indexableDongs: Array<{ city: string; district: string; dongName: string }>
}

export async function fetchLandSitemap(): Promise<LandSitemapData> {
  try {
    const json = await ssrFetch<{ data?: LandSitemapData }>(
      '/api/real-estate/land/sitemap',
      { timeoutMs: 25_000 },
    )
    return json.data ?? { cities: [], indexableDongs: [] }
  } catch (err) {
    console.error('[sitemap] fetchLandSitemap failed', err)
    return { cities: [], indexableDongs: [] }
  }
}

export interface AuctionSitemapData {
  regions: Array<{ city: string; district: string; bjdCode: string; usageGroup: string; isIndexable?: boolean }>
  items: string[]
}

export async function fetchAuctionSitemap(): Promise<AuctionSitemapData> {
  try {
    const json = await ssrFetch<{ data?: AuctionSitemapData }>(
      '/api/auction/sitemap',
      { timeoutMs: 25_000 },
    )
    return json.data ?? { regions: [], items: [] }
  } catch (err) {
    console.error('[sitemap] fetchAuctionSitemap failed', err)
    return { regions: [], items: [] }
  }
}

export async function fetchSubscriptionIds(): Promise<{ id: number; updatedAt: string }[]> {
  const cacheKey = 'subscriptions'
  const cached = getCached<{ id: number; updatedAt: string }>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: { id: number; updatedAt: string }[] }>(
      '/api/sitemap/subscriptions',
      { timeoutMs: 25_000 },
    )
    const data = json.data ?? []
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchSubscriptionIds failed', err)
    return []
  }
}
