import { defineEventHandler, setResponseHeader } from 'h3'
import { generateRssXml } from '../utils/rss'
import { ssrFetch } from '../utils/ssrFetch'

export default defineEventHandler(async (event) => {
  try {
    const guides = await ssrFetch<{ data?: { items: Array<{ title: string; slug: string; summary?: string | null; createdAt?: string | null }> } }>('/api/guides?limit=50')
    const items = (guides.data?.items || []).map(guide => ({
      title: guide.title,
      link: `https://ilsangkit.co.kr/guide/${guide.slug}`,
      description: guide.summary || guide.title,
      pubDate: guide.createdAt || new Date().toISOString(),
    }))

    const xml = generateRssXml(items, {
      title: '일상킷 - 생활 가이드',
      link: 'https://ilsangkit.co.kr/guide',
      description: '부동산 실거래가와 생활시설 정보를 제공하는 일상킷의 생활 가이드',
    })

    setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
    return xml
  }
  catch {
    setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    return generateRssXml([], {
      title: '일상킷 - 생활 가이드',
      link: 'https://ilsangkit.co.kr/guide',
      description: '부동산 실거래가와 생활시설 정보를 제공하는 일상킷의 생활 가이드',
    })
  }
})
