import { defineEventHandler, setResponseHeader } from 'h3'
import { generateRssXml } from '../utils/rss'
import { ssrFetch } from '../utils/ssrFetch'

export default defineEventHandler(async (event) => {
  try {
    const articles = await ssrFetch<{ data?: { items: Array<{ title: string; slug: string; summary?: string | null; publishedAt?: string | null }> } }>('/api/articles?limit=50')
    const items = (articles.data?.items || []).map(article => ({
      title: article.title,
      link: `https://ilsangkit.co.kr/article/${article.slug}`,
      description: article.summary || article.title,
      pubDate: article.publishedAt || new Date().toISOString(),
    }))

    const xml = generateRssXml(items, {
      title: '일상킷 - 오늘의 이슈',
      link: 'https://ilsangkit.co.kr/article',
      description: '부동산 실거래가와 청약 시장 동향을 요약하는 일상킷의 오늘의 이슈',
    })

    setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
    return xml
  }
  catch {
    setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
    return generateRssXml([], {
      title: '일상킷 - 오늘의 이슈',
      link: 'https://ilsangkit.co.kr/article',
      description: '부동산 실거래가와 청약 시장 동향을 요약하는 일상킷의 오늘의 이슈',
    })
  }
})
