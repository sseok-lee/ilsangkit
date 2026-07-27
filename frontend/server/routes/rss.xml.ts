import { defineEventHandler, setResponseHeader } from 'h3'
import { generateRssXml } from '../utils/rss'
import { ssrFetch } from '../utils/ssrFetch'

export default defineEventHandler(async (event) => {
  try {
    const guides = await ssrFetch<{ data?: { items: Array<{ title: string; slug: string; summary?: string | null; publishedAt?: string | null; createdAt?: string | null }> } }>('/api/guides?limit=50')
    const items = (guides.data?.items || []).map(guide => ({
      title: guide.title,
      link: `https://ilsangkit.co.kr/guide/${guide.slug}`,
      description: guide.summary || guide.title,
      // 가이드는 초안(publishedAt=null)으로 생성된 뒤 어드민 발행 시 publishedAt 이 채워진다.
      // createdAt 을 쓰면 초안 작성일이 발행일로 새어나가 상세 페이지 JSON-LD·사이트맵과 어긋난다.
      // 날짜가 아예 없으면 지어내지 않고 빈 값으로 넘겨 pubDate 요소를 생략시킨다.
      pubDate: guide.publishedAt || guide.createdAt || '',
    }))

    const xml = generateRssXml(items, {
      title: '일상킷 - 생활 가이드',
      link: 'https://ilsangkit.co.kr/guide',
      description: '부동산 실거래가와 생활시설 정보를 제공하는 일상킷의 생활 가이드',
      selfUrl: 'https://ilsangkit.co.kr/rss.xml',
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
      selfUrl: 'https://ilsangkit.co.kr/rss.xml',
    })
  }
})
