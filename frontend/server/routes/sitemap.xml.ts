// @TASK T5.2 - 동적 사이트맵 생성
import { defineEventHandler, setHeader } from 'h3'

const SITE_URL = 'https://ilsangkit.com'

// 카테고리 목록
const CATEGORIES = ['toilet', 'trash', 'wifi', 'clothes', 'kiosk']

// 시/도 목록
const CITIES = [
  { slug: 'seoul', name: '서울' },
  { slug: 'busan', name: '부산' },
  { slug: 'daegu', name: '대구' },
  { slug: 'incheon', name: '인천' },
  { slug: 'gwangju', name: '광주' },
  { slug: 'daejeon', name: '대전' },
  { slug: 'ulsan', name: '울산' },
  { slug: 'sejong', name: '세종' },
  { slug: 'gyeonggi', name: '경기' },
]

// 서울 구 목록 (가장 인기 있는 지역)
const SEOUL_DISTRICTS = [
  { slug: 'gangnam', name: '강남구' },
  { slug: 'seocho', name: '서초구' },
  { slug: 'songpa', name: '송파구' },
  { slug: 'gangdong', name: '강동구' },
  { slug: 'mapo', name: '마포구' },
  { slug: 'yeongdeungpo', name: '영등포구' },
  { slug: 'yongsan', name: '용산구' },
  { slug: 'jongno', name: '종로구' },
  { slug: 'jung', name: '중구' },
  { slug: 'seongdong', name: '성동구' },
  { slug: 'gwangjin', name: '광진구' },
  { slug: 'dongdaemun', name: '동대문구' },
  { slug: 'jungnang', name: '중랑구' },
  { slug: 'seongbuk', name: '성북구' },
  { slug: 'gangbuk', name: '강북구' },
  { slug: 'dobong', name: '도봉구' },
  { slug: 'nowon', name: '노원구' },
  { slug: 'eunpyeong', name: '은평구' },
  { slug: 'seodaemun', name: '서대문구' },
  { slug: 'dongjak', name: '동작구' },
  { slug: 'gwanak', name: '관악구' },
  { slug: 'gangseo', name: '강서구' },
  { slug: 'guro', name: '구로구' },
  { slug: 'geumcheon', name: '금천구' },
  { slug: 'yangcheon', name: '양천구' },
]

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

function generateSitemapXml(urls: SitemapUrl[]): string {
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

export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/xml')

  const today = new Date().toISOString().split('T')[0]
  const urls: SitemapUrl[] = []

  // 홈페이지
  urls.push({
    loc: SITE_URL,
    lastmod: today,
    changefreq: 'daily',
    priority: 1.0,
  })

  // 검색 페이지
  urls.push({
    loc: `${SITE_URL}/search`,
    lastmod: today,
    changefreq: 'daily',
    priority: 0.9,
  })

  // 카테고리별 검색 페이지
  for (const category of CATEGORIES) {
    urls.push({
      loc: `${SITE_URL}/search?category=${category}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
    })
  }

  // 지역별 페이지 (서울 + 카테고리)
  for (const district of SEOUL_DISTRICTS) {
    for (const category of CATEGORIES) {
      urls.push({
        loc: `${SITE_URL}/seoul/${district.slug}/${category}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: 0.7,
      })
    }
  }

  return generateSitemapXml(urls)
})
