const REAL_ESTATE_TYPES = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
]

const TYPE_META = {
  'apt-sale': { property: '아파트', transaction: '매매' },
  'apt-rent': { property: '아파트', transaction: '전월세' },
  'villa-sale': { property: '빌라', transaction: '매매' },
  'villa-rent': { property: '빌라', transaction: '전월세' },
  'offitel-sale': { property: '오피스텔', transaction: '매매' },
  'offitel-rent': { property: '오피스텔', transaction: '전월세' },
}

const FACILITY_META = [
  { category: 'hospital', label: '병원', count: 14 },
  { category: 'parking', label: '공영주차장', count: 7 },
  { category: 'wifi', label: '무료와이파이', count: 6 },
  { category: 'pharmacy', label: '약국', count: 5 },
  { category: 'library', label: '공공도서관', count: 4 },
  { category: 'park', label: '공원', count: 3 },
  { category: 'trash', label: '쓰레기 배출정보', count: 3 },
]

const control = {
  failures: [],
  zeros: [],
  delays: [],
  requests: [],
}

export const explorationRegions = [
  {
    city: '서울특별시',
    district: '강남구',
    slug: 'gangnam',
    bjdCode: '1168010100',
    lat: 37.5172,
    lng: 127.0473,
  },
  {
    city: '경기',
    district: '수원시',
    slug: 'suwon',
    bjdCode: '4111110000',
    lat: 37.2636,
    lng: 127.0286,
  },
]

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function ok(res, data) {
  json(res, 200, { success: true, data })
}

function fail(res, status, message) {
  json(res, status, {
    success: false,
    error: { code: 'EXPLORATION_FIXTURE_FAILURE', message },
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function resetControl() {
  control.failures = []
  control.zeros = []
  control.delays = []
  control.requests = []
}

function normalizeRule(rule) {
  return {
    domain: String(rule.domain ?? ''),
    ...(rule.keyword != null ? { keyword: String(rule.keyword) } : {}),
    ...(rule.type != null ? { type: String(rule.type) } : {}),
    ...(rule.city != null ? { city: String(rule.city) } : {}),
    ...(rule.district != null ? { district: String(rule.district) } : {}),
    ...(rule.page != null ? { page: Number(rule.page) } : {}),
    ...(rule.level != null ? { level: Number(rule.level) } : {}),
    ...(rule.count != null ? { count: Math.max(0, Number(rule.count)) } : {}),
    ...(rule.ms != null ? { ms: Math.max(0, Number(rule.ms)) } : {}),
  }
}

function controlSnapshot() {
  return {
    failures: control.failures.map((rule) => ({ ...rule })),
    zeros: control.zeros.map((rule) => ({ ...rule })),
    delays: control.delays.map((rule) => ({ ...rule })),
    requests: control.requests.map((request) => ({ ...request })),
  }
}

function matches(rule, request) {
  return ['domain', 'keyword', 'type', 'city', 'district', 'page', 'level'].every(
    (key) => rule[key] == null || rule[key] === request[key]
  )
}

function consumeRule(rules, request) {
  const index = rules.findIndex((rule) => matches(rule, request) && (rule.count ?? 1) > 0)
  if (index < 0) return false
  const remaining = (rules[index].count ?? 1) - 1
  if (remaining <= 0) rules.splice(index, 1)
  else rules[index] = { ...rules[index], count: remaining }
  return true
}

function delayFor(request) {
  return control.delays.find((rule) => matches(rule, request))?.ms ?? 0
}

async function prepareRequest(request) {
  control.requests.push({ ...request, attempt: control.requests.length + 1 })
  const delayMs = delayFor(request)
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
  return {
    fail: consumeRule(control.failures, request),
    zero: consumeRule(control.zeros, request),
  }
}

function deal(kind, index) {
  if (kind === 'sale') {
    return {
      kind,
      amount: 98000 + index * 125,
      deposit: null,
      monthlyRent: null,
      exclusiveArea: 84.92,
      floor: 12,
      dealYear: 2026,
      dealMonth: 9,
      dealDay: 20,
    }
  }
  if (kind === 'jeonse') {
    return {
      kind,
      amount: null,
      deposit: 61000 + index * 75,
      monthlyRent: 0,
      exclusiveArea: 84.92,
      floor: 9,
      dealYear: 2026,
      dealMonth: 9,
      dealDay: 18,
    }
  }
  return {
    kind,
    amount: null,
    deposit: 12000 + index * 50,
    monthlyRent: 185 + index,
    exclusiveArea: 59.87,
    floor: 7,
    dealYear: 2026,
    dealMonth: 9,
    dealDay: 12,
  }
}

function latestDeals(index) {
  return {
    sale: deal('sale', index),
    jeonse: deal('jeonse', index),
    wolse: deal('wolse', index),
  }
}

function typeLabel(type) {
  const meta = TYPE_META[type] ?? TYPE_META['apt-sale']
  return `${meta.property} ${meta.transaction}`
}

function buildingName(type, scope, page, index) {
  const pageLabel = page > 1 ? ` ${page}페이지` : ''
  return `검증 ${typeLabel(type)} ${scope}${pageLabel} ${String(index).padStart(2, '0')}`
}

function complex(type, name, index, city = '서울', district = '강남구') {
  const bundle = latestDeals(index)
  return {
    type,
    buildingName: name,
    bjdCode: `11680101${String(index).padStart(2, '0')}`,
    dongName: index % 2 === 0 ? '역삼동' : '대치동',
    city,
    district,
    latestPrice: type.endsWith('-sale') ? bundle.sale.amount : bundle.jeonse.deposit,
    transactionCount: 80 - Math.min(index, 60),
    lat: 37.49 + index * 0.0002,
    lng: 127.02 + index * 0.0002,
    lastDealYear: 2026,
    lastDealMonth: 9,
    buildYear: 2000 + (index % 20),
    latestDeals: bundle,
  }
}

function listScope(city, district) {
  if (district) return district
  if (city) return city
  return '전국'
}

function complexList(type, searchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.max(1, Number(searchParams.get('limit') ?? 15))
  const city = searchParams.get('city') || ''
  const district = searchParams.get('district') || ''
  const total = 52
  const pageCount = Math.max(0, Math.min(limit, total - (page - 1) * limit))
  const scope = listScope(city, district)
  return {
    items: Array.from({ length: pageCount }, (_, offset) =>
      complex(type, buildingName(type, scope, page, offset + 1), (page - 1) * limit + offset + 1)
    ),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

function propertyComplexList(property, keyword, page, limit) {
  const type = `${property}-sale`
  const total = 45
  const pageCount = Math.max(0, Math.min(limit, total - (page - 1) * limit))
  const pageLabel = page > 1 ? ` ${page}페이지` : ''
  return {
    items: Array.from({ length: pageCount }, (_, offset) =>
      complex(
        type,
        `${keyword} ${TYPE_META[type].property} 검색${pageLabel} ${String(offset + 1).padStart(2, '0')}`,
        (page - 1) * limit + offset + 1
      )
    ),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

function groupedBuildings(keyword) {
  return {
    categories: REAL_ESTATE_TYPES.map((type, typeIndex) => {
      const property = TYPE_META[type].property
      return {
        type,
        count: [31, 38, 24, 29, 13, 16][typeIndex],
        items: Array.from({ length: 3 }, (_, offset) =>
          complex(
            type,
            `${keyword} ${property} 공통 ${String(offset + 1).padStart(2, '0')}`,
            typeIndex * 10 + offset + 1
          )
        ),
      }
    }),
    buildingCounts: { apt: 23, villa: 17, offitel: 11 },
  }
}

function facility(category, keyword, index) {
  const label = FACILITY_META.find((entry) => entry.category === category)?.label ?? category
  const extras = category === 'parking'
    ? { capacity: 120 + index, feeType: '유료', baseFee: index === 1 ? null : 1000 }
    : category === 'library'
      ? { weekdayOpenTime: '09:00', weekdayCloseTime: '18:00', seatCount: 80 + index }
      : category === 'wifi'
        ? { ssid: `fixture-${index}`, installLocation: '검증 로비' }
        : { phone: `02-555-${String(index).padStart(4, '0')}` }
  return {
    id: `exploration-${category}-${index}`,
    name: `${keyword} ${label} ${String(index).padStart(2, '0')}`,
    category,
    address: `서울특별시 강남구 검증로 ${index}`,
    roadAddress: `서울특별시 강남구 검증로 ${index}`,
    lat: 37.5 + index * 0.0001,
    lng: 127.03 + index * 0.0001,
    city: '서울특별시',
    district: '강남구',
    extras,
  }
}

function groupedFacilities(keyword) {
  return {
    categories: FACILITY_META.map(({ category, label, count }) => ({
      category,
      label,
      count,
      items: Array.from({ length: Math.min(3, count) }, (_, index) =>
        facility(category, keyword, index + 1)
      ),
    })),
    totalCount: 42,
    parsed: {
      original: keyword,
      normalized: keyword,
      categoryToken: null,
      locationTokens: [],
      freeText: keyword,
    },
    recovery: null,
  }
}

function regionItems(granularity) {
  if (granularity === 'city') {
    return [
      { name: '서울', district: null, dong: null, lat: 37.5665, lng: 126.978, avgPricePerPyeong: 4150, transactionCount: 520 },
      { name: '경기', district: null, dong: null, lat: 37.4138, lng: 127.5183, avgPricePerPyeong: 2840, transactionCount: 470 },
      { name: '부산', district: null, dong: null, lat: 35.1796, lng: 129.0756, avgPricePerPyeong: 1920, transactionCount: 210 },
    ]
  }
  if (granularity === 'district') {
    return [
      { name: '서울', district: '강남구', dong: null, lat: 37.5172, lng: 127.0473, avgPricePerPyeong: 6820, transactionCount: 140 },
      { name: '서울', district: '서초구', dong: null, lat: 37.4837, lng: 127.0324, avgPricePerPyeong: 6450, transactionCount: 120 },
      { name: '서울', district: '송파구', dong: null, lat: 37.5145, lng: 127.1059, avgPricePerPyeong: 5720, transactionCount: 110 },
    ]
  }
  return [
    { name: '서울', district: '강남구', dong: '역삼동', lat: 37.5007, lng: 127.0365, avgPricePerPyeong: 6710, transactionCount: 72 },
    { name: '서울', district: '강남구', dong: '대치동', lat: 37.493, lng: 127.056, avgPricePerPyeong: 7230, transactionCount: 68 },
    { name: '서울', district: '강남구', dong: '삼성동', lat: 37.514, lng: 127.056, avgPricePerPyeong: 6940, transactionCount: 61 },
  ]
}

function buildingMapItems(type) {
  return Array.from({ length: 6 }, (_, index) => {
    const item = complex(type, `검증 지도 ${typeLabel(type)} ${String(index + 1).padStart(2, '0')}`, index + 1)
    return {
      buildingName: item.buildingName,
      bjdCode: item.bjdCode,
      city: item.city,
      district: item.district,
      dongName: item.dongName,
      lat: item.lat,
      lng: item.lng,
      latestPrice: item.latestPrice,
      monthlyRent: type.endsWith('-rent') ? item.latestDeals.wolse.monthlyRent : null,
      latestDealYear: 2026,
      latestDealMonth: 9,
      latestDealDay: 20,
      jeonseDeposit: type.endsWith('-rent') ? item.latestDeals.jeonse.deposit : null,
      jeonseDealKey: type.endsWith('-rent') ? 20260918 : null,
      wolseDeposit: type.endsWith('-rent') ? item.latestDeals.wolse.deposit : null,
      wolseMonthlyRent: type.endsWith('-rent') ? item.latestDeals.wolse.monthlyRent : null,
      wolseDealKey: type.endsWith('-rent') ? 20260912 : null,
      transactionCount: item.transactionCount,
      latestDeals: item.latestDeals,
    }
  })
}

function mapResult(type, level) {
  const granularity = level >= 11
    ? 'city'
    : level >= 9
      ? 'district'
      : level >= 7
        ? 'dong'
        : 'building'
  const items = granularity === 'building' ? buildingMapItems(type) : regionItems(granularity)
  return {
    granularity,
    items,
    total: items.length,
    exact: true,
  }
}

function emptyResult(domain, request) {
  if (domain === 'buildings') return { categories: [], buildingCounts: { apt: 0, villa: 0, offitel: 0 } }
  if (domain === 'facilities') {
    return {
      categories: [],
      totalCount: 0,
      parsed: { original: request.keyword, normalized: request.keyword, categoryToken: null, locationTokens: [], freeText: request.keyword },
      recovery: null,
    }
  }
  if (domain === 'property' || domain === 'complexes') {
    return { items: [], total: 0, page: request.page ?? 1, totalPages: 0 }
  }
  return { granularity: request.level >= 11 ? 'city' : 'building', items: [], total: 0, exact: true }
}

async function respond(res, request, dataFactory) {
  const state = await prepareRequest(request)
  if (state.fail) {
    fail(res, 503, `${request.domain} transient fixture failure`)
    return
  }
  ok(res, state.zero ? emptyResult(request.domain, request) : dataFactory())
}

export async function handleExplorationRequest(req, res, url) {
  const path = url.pathname

  if (path === '/__test/exploration/reset') {
    if (req.method !== 'POST') fail(res, 405, 'method not allowed')
    else {
      resetControl()
      ok(res, controlSnapshot())
    }
    return true
  }

  if (path === '/__test/exploration/control') {
    if (req.method !== 'POST') {
      fail(res, 405, 'method not allowed')
      return true
    }
    try {
      const body = await readBody(req)
      if (body.reset) resetControl()
      if (Array.isArray(body.failures)) control.failures = body.failures.map(normalizeRule)
      if (Array.isArray(body.zeros)) control.zeros = body.zeros.map(normalizeRule)
      if (Array.isArray(body.delays)) control.delays = body.delays.map(normalizeRule)
      ok(res, controlSnapshot())
    } catch (error) {
      fail(res, 400, error instanceof Error ? error.message : 'invalid body')
    }
    return true
  }

  if (path === '/api/real-estate/search' && req.method === 'GET') {
    const keyword = url.searchParams.get('keyword') || ''
    await respond(res, { domain: 'buildings', keyword }, () => groupedBuildings(keyword))
    return true
  }

  if (path === '/api/real-estate/complexes/search' && req.method === 'GET') {
    const keyword = url.searchParams.get('keyword') || ''
    const type = url.searchParams.get('propertyType') || 'apt'
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20))
    await respond(res, { domain: 'property', keyword, type, page }, () =>
      propertyComplexList(type, keyword, page, limit)
    )
    return true
  }

  if (path === '/api/facilities/search' && req.method === 'POST') {
    try {
      const body = await readBody(req)
      if (!body.grouped) return false
      const keyword = String(body.keyword ?? '')
      await respond(res, { domain: 'facilities', keyword }, () => groupedFacilities(keyword))
    } catch (error) {
      fail(res, 400, error instanceof Error ? error.message : 'invalid body')
    }
    return true
  }

  const facilityDetailMatch = path.match(
    /^\/api\/facilities\/([^/]+)\/(exploration-\1-(\d+))$/
  )
  if (facilityDetailMatch && req.method === 'GET') {
    const [, category, id, rawIndex] = facilityDetailMatch
    const item = facility(category, '검증', Number(rawIndex))
    ok(res, {
      ...item,
      id,
      bjdCode: '1168010100',
      details: item.extras,
      sourceId: 'exploration-fixture',
      sourceUrl: null,
      viewCount: 1,
      createdAt: '2026-09-22T00:00:00Z',
      updatedAt: '2026-09-22T00:00:00Z',
      syncedAt: '2026-09-22T00:00:00Z',
    })
    return true
  }

  const regionFacilitiesMatch = path.match(
    /^\/api\/facilities\/region\/seoul\/gangnam\/([^/]+)$/
  )
  if (regionFacilitiesMatch && req.method === 'GET') {
    const category = regionFacilitiesMatch[1]
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20))
    const configuredCount = FACILITY_META.find((entry) => entry.category === category)?.count ?? 3
    const pageCount = Math.max(0, Math.min(limit, configuredCount - (page - 1) * limit))
    ok(res, {
      items: Array.from({ length: pageCount }, (_, index) =>
        facility(category, '검증 강남구', (page - 1) * limit + index + 1)
      ),
      total: configuredCount,
      page,
      totalPages: Math.ceil(configuredCount / limit),
    })
    return true
  }

  const areaSummaryMatch = path.match(
    /^\/api\/area\/seoul\/gangnam\/([^/]+)\/summary$/
  )
  if (areaSummaryMatch && req.method === 'GET') {
    const category = areaSummaryMatch[1]
    const count = FACILITY_META.find((entry) => entry.category === category)?.count ?? 3
    ok(res, {
      count,
      countDiff: 1,
      highlights: [],
      nearbyDistricts: [],
      lastSyncedAt: '2026-09-22T00:00:00Z',
    })
    return true
  }

  const complexesMatch = path.match(/^\/api\/real-estate\/([^/]+)\/complexes$/)
  if (complexesMatch && REAL_ESTATE_TYPES.includes(complexesMatch[1]) && req.method === 'GET') {
    const type = complexesMatch[1]
    const city = url.searchParams.get('city') || ''
    const district = url.searchParams.get('district') || ''
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const request = { domain: 'complexes', type, city, district, page }
    await respond(res, request, () => complexList(type, url.searchParams))
    return true
  }

  const mapMatch = path.match(/^\/api\/real-estate\/([^/]+)\/map$/)
  if (mapMatch && REAL_ESTATE_TYPES.includes(mapMatch[1]) && req.method === 'GET') {
    const type = mapMatch[1]
    const level = Number(url.searchParams.get('level') ?? 13)
    await respond(res, { domain: 'map', type, level }, () => mapResult(type, level))
    return true
  }

  return false
}
