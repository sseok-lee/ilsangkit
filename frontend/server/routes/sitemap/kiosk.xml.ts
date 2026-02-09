// 무인민원발급기 상세 페이지 사이트맵
import { defineEventHandler, setHeader } from 'h3'
import { SITE_URL, generateSitemapXml, formatDateForSitemap, fetchFacilityIds } from '../../utils/sitemap'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const items = await fetchFacilityIds('kiosk', apiBase)

  const urls = items.map((item) => ({
    loc: `${SITE_URL}/kiosk/${item.id}`,
    lastmod: formatDateForSitemap(item.updatedAt),
    changefreq: 'monthly' as const,
    priority: 0.6,
  }))

  return generateSitemapXml(urls)
})
