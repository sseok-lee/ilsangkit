const date = '2026-09-23T00:00:00.000Z'
const content = `## 이용 **안내**
실제 공개 자료를 확인하는 방법입니다. [공공데이터포털](https://www.data.go.kr)
## 이용 **안내**
같은 제목이어도 목차에서 각각 이동할 수 있습니다.
### 세부 \`정보\`
주소와 운영 시간을 함께 확인하세요.
## 출처 & 확인
<img src="https://example.invalid/remaining-image.png" onerror="alert(1)"><script>alert(1)</script>
<a href="javascript:alert(1)">안전하지 않은 링크</a>
<h2 id="existing-anchor">기존 제목</h2>
| 항목 | 확인 내용 |
| --- | --- |
| 주소 | 서울특별시 강남구 |
`
function records(kind) {
  return Array.from({ length: 25 }, (_, index) => {
    const number = index + 1
    return {
      id: `${kind}-${number}`, slug: `remaining-${kind}-${number}`,
      title: `${number <= 13 ? '주차' : '주거'} ${kind === 'guide' ? '가이드' : '이슈'}${number}${number === 2 ? ' — 긴 제목에서도 생활정보를 빠짐없이 확인하는 방법' : ''}`,
      summary: '지역의 공개 자료와 실제 이용 조건을 함께 확인하는 안내입니다.',
      category: number <= 13 ? (number % 2 ? 'parking' : 'ev-charger') : number === 25 ? 'library' : 'apt-sale',
      articleType: kind === 'guide' ? 'guide' : 'news', thumbnailUrl: null,
      publishedAt: kind === 'article' && number === 25 ? null : date, createdAt: date, updatedAt: date,
      keywords: null, viewCount: 120, content, published: true,
      ...(kind === 'article' ? { sources: [{ title: '공공데이터포털', url: 'https://www.data.go.kr' }] } : {}),
    }
  })
}
export function handleEditorialFixture(url) {
  const match = url.pathname.match(/^\/api\/(guides|articles)(?:\/([^/]+))?$/)
  if (!match) return null
  const kind = match[1] === 'guides' ? 'guide' : 'article'
  const all = records(kind)
  const slug = match[2]
  const ok = (data) => ({ status: 200, body: { success: true, data } })
  if (slug === 'recent') return ok(all.slice(0, Number(url.searchParams.get('limit') || 4)))
  if (slug) {
    if (!slug.startsWith('remaining-')) return null
    const item = all.find(row => row.slug === slug)
    return item ? ok(item) : { status: 404, body: { success: false, error: 'Content not found' } }
  }
  const categories = (url.searchParams.get('categories') || url.searchParams.get('category') || '').split(',').filter(Boolean)
  const filtered = categories.length ? all.filter(item => categories.includes(item.category)) : all
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const limit = Math.max(1, Number(url.searchParams.get('limit') || 12))
  return ok({ items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, totalPages: Math.ceil(filtered.length / limit) })
}
