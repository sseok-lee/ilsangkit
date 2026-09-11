import { createServer } from 'node:http'

const building = (name) => ({
  buildingName: name, bjdCode: '1168010100', city: '서울특별시', district: '강남구',
  dongName: '역삼동', roadName: '테헤란로 123', jibun: '123', buildYear: 2000,
  minArea: 84, maxArea: 84, latestDealAmount: 85000, latestMonthlyRent: 0,
  latestDealYear: 2026, latestDealMonth: 8, lat: 37.5, lng: 127.03,
  transactionCount: 12, latestPrice: 85000, jeonseCount: 8, wolseCount: 4,
})
const facility = {
  id: 'hospital-seo-fixture', name: '렌더링회복병원', category: 'hospital',
  address: '서울특별시 강남구 역삼동 123', roadAddress: '서울특별시 강남구 테헤란로 123',
  city: '서울특별시', district: '강남구', bjdCode: '1168010100', lat: 37.5, lng: 127.03,
  details: { clCdNm: '의원', phone: '02-1234-5678', departments: [{ dgsbjtCdNm: '내과', dgsbjtPrSdrCnt: 2 }], drTotCnt: 2 },
  sourceId: 'fixture', sourceUrl: null, viewCount: 1,
  createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', syncedAt: '2026-08-01T00:00:00Z',
}
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  const name = url.searchParams.get('buildingName') || '회복아파트'
  const info = building(name)
  if (path === '/api/real-estate/nearby' && url.searchParams.get('excludeBuildingName') === '재시도아파트') {
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'SSR fixture transient failure' }))
    return
  }
  let data = {}
  if (path === '/health') data = { ok: true }
  else if (path === '/api/facilities/hospital/hospital-seo-fixture') data = facility
  else if (path.endsWith('/complexes')) data = { items: [info], total: 1, page: 1, totalPages: 1 }
  else if (path.endsWith('/building-info')) data = info
  else if (path.endsWith('/stats')) data = { monthly: [{ year: 2026, month: 8, avgPrice: 85000, maxPrice: 85000, minPrice: 85000, count: 12 }], summary: { recentAvg: 85000, previousAvg: 80000, changeRate: 6.25, totalCount: 12, lowVolume: false, priceLabel: '매매가' } }
  else if (path.match(/\/real-estate\/[^/]+\/search$/)) data = { items: [{ ...info, id: 1, exclusiveArea: 84, floor: 10, dealYear: 2026, dealMonth: 8, dealDay: 15, dealAmount: 85000, deposit: 85000, monthlyRent: 0, rentType: '전세', cancelDealDay: null }], total: 12, page: 1, totalPages: 1 }
  else if (path.endsWith('/area-groups')) data = [{ area: 84, pyeong: 25, count: 12 }]
  else if (path === '/api/real-estate/nearby') data = { apt: [building(url.searchParams.get('excludeBuildingName') === '이웃아파트' ? '회복아파트' : '이웃아파트')], villa: [], offitel: [] }
  else if (path.endsWith('/price-analysis')) data = null
  else if (path.endsWith('/nearby-counts')) data = { radius: 300, counts: {} }
  else if (path.includes('/guides') || path.includes('/blog') || path.endsWith('/search')) data = { items: [], total: 0 }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ success: true, data }))
}).listen(18080, '127.0.0.1', () => console.log('SEO fixture API: 18080'))
