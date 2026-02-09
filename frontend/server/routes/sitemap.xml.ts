// 사이트맵 인덱스 — 6개 sub-sitemap 참조
import { defineEventHandler, setHeader } from 'h3'
import { SITE_URL, generateSitemapIndexXml } from '../utils/sitemap'

const SUB_SITEMAPS = ['static', 'toilet', 'wifi', 'clothes', 'kiosk', 'trash']

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]

  const sitemaps = SUB_SITEMAPS.map((name) => ({
    loc: `${SITE_URL}/sitemap/${name}.xml`,
    lastmod: today,
  }))

  return generateSitemapIndexXml(sitemaps)
})
