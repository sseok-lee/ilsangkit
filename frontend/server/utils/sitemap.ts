export const SITE_URL = 'https://ilsangkit.co.kr'

export const MAX_URLS_PER_SITEMAP = 10_000

export interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
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
  const urlElements = urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`]
      if (url.lastmod) parts.push(`    <lastmod>${url.lastmod}</lastmod>`)
      if (url.changefreq) parts.push(`    <changefreq>${url.changefreq}</changefreq>`)
      if (url.priority !== undefined) parts.push(`    <priority>${url.priority.toFixed(1)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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

export function formatDateForSitemap(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
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
  apiBase: string
): Promise<{ id: string; updatedAt: string }[]> {
  const cacheKey = `facility:${category}`
  const cached = getCached<{ id: string; updatedAt: string }>(cacheKey)
  if (cached) return cached

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${apiBase}/api/sitemap/facilities/${category}`)
      if (!res.ok) {
        console.error(`[sitemap] fetchFacilityIds(${category}) attempt ${attempt}: HTTP ${res.status}`)
        continue
      }
      const json = await res.json()
      const data = json.data || []
      if (data.length > 0) {
        setCache(cacheKey, data)
      }
      return data
    } catch (err) {
      console.error(`[sitemap] fetchFacilityIds(${category}) attempt ${attempt} error:`, err)
    }
  }
  return []
}

export async function fetchWasteScheduleIds(
  apiBase: string
): Promise<{ id: number; updatedAt: string }[]> {
  const cacheKey = 'waste-schedules'
  const cached = getCached<{ id: number; updatedAt: string }>(cacheKey)
  if (cached) return cached

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${apiBase}/api/sitemap/waste-schedules`)
      if (!res.ok) {
        console.error(`[sitemap] fetchWasteScheduleIds attempt ${attempt}: HTTP ${res.status}`)
        continue
      }
      const json = await res.json()
      const data = json.data || []
      if (data.length > 0) {
        setCache(cacheKey, data)
      }
      return data
    } catch (err) {
      console.error(`[sitemap] fetchWasteScheduleIds attempt ${attempt} error:`, err)
    }
  }
  return []
}

export async function fetchRegionCategories(
  apiBase: string
): Promise<Array<{ city: string; district: string; category: string }>> {
  const cacheKey = 'region-categories'
  const cached = getCached<{ city: string; district: string; category: string }>(cacheKey)
  if (cached) return cached

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${apiBase}/api/sitemap/region-categories`)
      if (!res.ok) {
        console.error(`[sitemap] fetchRegionCategories attempt ${attempt}: HTTP ${res.status}`)
        continue
      }
      const json = await res.json()
      const data = json.data || []
      if (data.length > 0) {
        setCache(cacheKey, data)
      }
      return data
    } catch (err) {
      console.error(`[sitemap] fetchRegionCategories attempt ${attempt} error:`, err)
    }
  }
  return []
}
