export const SITE_URL = 'https://ilsangkit.co.kr'

export const MAX_URLS_PER_SITEMAP = 45_000

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

export function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls
    .map((url) => {
      const parts = [`    <loc>${url.loc}</loc>`]
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
      const parts = [`    <loc>${s.loc}</loc>`]
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

export async function fetchFacilityIds(
  category: string,
  apiBase: string
): Promise<{ id: string; updatedAt: string }[]> {
  const res = await fetch(`${apiBase}/api/sitemap/facilities/${category}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

export async function fetchWasteScheduleIds(
  apiBase: string
): Promise<{ id: number; updatedAt: string }[]> {
  const res = await fetch(`${apiBase}/api/sitemap/waste-schedules`)
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}
