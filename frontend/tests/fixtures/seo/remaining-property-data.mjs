const ok = data => ({ status: 200, body: { success: true, data } })
const missing = () => ({ status: 404, body: { success: false, error: 'Not found' } })
const city = '서울특별시'
const district = '강남구'
const statuses = ['ongoing', 'scheduled', 'negotiable', 'closed', 'sold', 'failed', 'cancelled']
const items = Array.from({ length: 32 }, (_, index) => {
  const id = index + 1
  const status = statuses[index % statuses.length]
  return {
    id, cltrMngNo: `remaining-${String(id).padStart(3, '0')}`, pbctCdtnNo: `condition-${id}`, plnmNo: 'notice-1',
    city, district, bjdCode: '11680', dongName: '역삼동', address: `서울특별시 강남구 역삼동 검증물건 ${id}`,
    usage: id % 2 ? '대지' : '오피스텔', usageGroup: id % 2 ? 'land' : 'residential', propertyType: '압류재산',
    dpslMtdNm: '매각', bidMethod: '전자입찰', competitionMethod: '일반경쟁', bidType: '인터넷',
    evictionResp: '매수자', isShare: id === 2, thumbnailUrl: null, landArea: 130, bldArea: 84,
    apslAssAmt: id === 3 ? null : 300000000, minBidPrc: id === 3 ? null : 210000000,
    failCnt: 2, bidRound: 3, bidBeginDtm: '2026-12-01T10:00:00.000Z',
    bidCloseDtm: `2026-12-${String(2 + index % 15).padStart(2, '0')}T16:00:00.000Z`, orgNm: '한국자산관리공사',
    pvctTrgtYn: status === 'negotiable', status, isClosed: ['closed', 'sold', 'failed', 'cancelled'].includes(status),
    resultType: status === 'sold' ? '낙찰' : null, winBidPrc: status === 'sold' ? 240000000 : null,
    bidRate: status === 'sold' ? 80 : null, resultDate: status === 'sold' ? '2026-09-01T00:00:00.000Z' : null,
    lat: null, lng: null,
  }
})
// More than one page; null day and shared land are retained, cancelled records excluded.
const landRows = Array.from({ length: 27 }, (_, index) => ({
  id: index + 1, jibun: `검증-${index + 1}`, jimok: index < 25 ? '대' : '도로',
  landUse: index < 25 ? '제2종일반주거지역' : '일반상업지역', dealArea: 100 + index,
  shareDeal: index === 1, dealAmount: 30000 + index * 100, dealType: '중개거래',
  dealYear: 2026, dealMonth: 9, dealDay: index === 2 ? null : (index % 28) + 1,
  pricePerPyeong: 990, cancelled: index === 26,
}))
const validLand = landRows.filter(row => !row.cancelled).sort((a, b) => (b.dealDay ?? 0) - (a.dealDay ?? 0) || b.id - a.id)
const options = { jimok: ['대', '도로'], landUse: ['제2종일반주거지역', '일반상업지역'] }
const regions = ['역삼동', '삼성동'].map((dongName, i) => ({
  bjdCode: '11680', dongName, city, district, transactionCount: validLand.length,
  recentCount: validLand.length, avgPricePerPyeong: 990 + i * 100, latestDealDate: '2026-09-26',
  isIndexable: true, jimokBreakdown: { 대: 25, 도로: 1 }, daeCount: 25, daeNonShareCount: 24,
}))
const rankings = [
  { district: '강남구', usageGroup: 'land', avgBidRate: 80, soldCount: 12 },
  { district: '강남구', usageGroup: 'residential', avgBidRate: 92, soldCount: 4 },
  { district: '송파구', usageGroup: 'land', avgBidRate: 75, soldCount: 20 },
  { district: '서초구', usageGroup: 'land', avgBidRate: 99, soldCount: 2 },
].map((row, i) => ({ bjdCode: ['11680', '11680', '11710', '11650'][i], city, activeCount: 5, closedCount: 4,
  avgApslAmt: 300000000, avgWinBidPrc: 240000000, failRate: 30, latestResultDate: '2026-09-01', isIndexable: true, ...row }))
function pageOf(rows, q) {
  const page = Math.max(1, Number(q.get('page') || 1))
  const limit = Math.max(1, Number(q.get('limit') || 20))
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, totalPages: Math.ceil(rows.length / limit) }
}
export function handlePropertyFixture(url) {
  const path = url.pathname
  if (!path.startsWith('/api/auction/') && !path.startsWith('/api/real-estate/land/')) return null
  const q = url.searchParams
  const keyword = (q.get('keyword') || '').trim()
  if (path.startsWith('/api/real-estate/land/')) {
    if (path.endsWith('/hub-summary')) return ok({ cities: [{ city, slug: 'seoul', indexableDongCount: 2, totalTransactions: 52 }], totalTransactions: 52 })
    if (path.endsWith('/regions')) return ok(pageOf(regions.filter(row => ['city', 'district', 'dongName'].every(key => !q.get(key) || q.get(key) === row[key] || (key === 'city' && q.get(key) === '서울'))), q))
    if (q.get('bjdCode') !== '11680' || !regions.some(row => row.dongName === q.get('dongName'))) return missing()
    if (path.endsWith('/transactions')) return ok({ ...pageOf(validLand.filter(row =>
      (!keyword || [row.jibun, row.jimok, row.landUse].some(value => value.includes(keyword)))
      && (!q.get('jimok') || row.jimok === q.get('jimok'))
      && (!q.get('landUse') || row.landUse === q.get('landUse'))), q), filterOptions: options })
    if (path.endsWith('/region')) return ok({ ...pageOf(validLand, q),
      jimokGroups: [{ group: '대', count: 19, avgPricePerPyeong: 990 }, { group: '도로', count: 1, avgPricePerPyeong: null }],
      daeSamples: validLand.filter(row => !row.shareDeal && row.jimok === '대').slice(0, 5), daeNonShareCount: 19, daeCount: 19,
      landUseDistribution: [{ landUse: '제2종일반주거지역', count: 19 }, { landUse: '일반상업지역', count: 1 }],
      priceTimeline: [{ year: 2026, quarter: 3, avgPricePerPyeong: 990, count: 20 }], filterOptions: options,
      // Small test sample cap exercises the same explicit total/sample distinction as production's 5000 cap.
      statsMeta: { totalTransactions: 26, sampleLimit: 20, sampledTransactions: 20, isSampleCapped: true },
    })
    return missing()
  }
  if (path.endsWith('/hub-summary')) return ok({ totalActive: items.filter(row => !row.isClosed).length, totalSold: items.filter(row => row.status === 'sold').length, regionCount: 1 })
  if (path.endsWith('/items')) {
    const status = q.get('status')
    const rows = items.filter(row => (!status || (q.get('statusMode') === 'exact' ? row.status === status
      : status === 'ongoing' ? ['ongoing', 'scheduled'].includes(row.status)
      : status === 'closed' ? row.isClosed || row.status === 'closed' : row.status === status))
      && (!keyword || [row.address, row.usage, row.cltrMngNo].some(value => value.includes(keyword)))
      && (!q.get('city') || [row.city, '서울'].includes(q.get('city')))
      && (!q.get('district') || row.district === q.get('district'))
      && (!q.get('usage') || row.usageGroup === q.get('usage')))
    const sort = q.get('sort') || 'deadline'
    rows.sort((a, b) => sort === 'apsl' ? (b.apslAssAmt ?? 0) - (a.apslAssAmt ?? 0)
      : sort === 'bidRate' ? (b.bidRate ?? 0) - (a.bidRate ?? 0)
      : (a.isClosed ? 3 : ['ongoing', 'scheduled', 'negotiable'].indexOf(a.status)) - (b.isClosed ? 3 : ['ongoing', 'scheduled', 'negotiable'].indexOf(b.status)) || a.bidCloseDtm.localeCompare(b.bidCloseDtm) || a.id - b.id)
    return ok(pageOf(rows, q))
  }
  if (path.includes('/item/')) {
    const item = items.find(row => row.cltrMngNo === decodeURIComponent(path.split('/').pop()))
    return item ? ok({ item, nearby: items.filter(row => row.id !== item.id).slice(0, 3), marketCompare: null }) : missing()
  }
  if (path.endsWith('/ranking')) {
    const rows = rankings.filter(row => row.isIndexable && row.soldCount >= 3 && row.avgBidRate != null
      && (!keyword || [row.city, row.district].some(value => value.includes(keyword))) && (!q.get('usage') || row.usageGroup === q.get('usage')))
    const order = q.get('order') || 'high'
    rows.sort((a, b) => order === 'count' ? b.soldCount - a.soldCount : order === 'low' ? a.avgBidRate - b.avgBidRate : b.avgBidRate - a.avgBidRate)
    return ok(rows.slice(0, Number(q.get('limit') || 20)))
  }
  if (path.endsWith('/regions')) return ok({ items: [{ bjdCode: '11680', city, district, activeCount: 10, closedCount: 10, soldCount: 4, isIndexable: true }] })
  if (path.endsWith('/city')) return ok({ districts: [{ district, bjdCode: '11680', activeCount: 10, soldCount: 4, isIndexable: true }] })
  if (path.endsWith('/region')) return ok({ usageGroups: rankings.filter(row => row.district === district), activeItems: items.filter(row => !row.isClosed).slice(0, 8), recentSold: items.filter(row => row.status === 'sold') })
  return missing()
}
