import { handleLifestyleFixture } from './remaining-lifestyle-data.mjs'
import { handlePropertyFixture } from './remaining-property-data.mjs'
import { handleEditorialFixture } from './remaining-editorial-data.mjs'
import {
  handleWasteAreaFixture,
  setWasteAreaFixtureControl,
  wasteAreaFixtureState,
} from './waste-area-data.mjs'
import { createServer } from 'node:http'
import {
  explorationRegions,
  handleExplorationRequest,
} from './exploration-search-data.mjs'
import {
  baseBuilding,
  detailOverview,
  detailPage,
  detailSnapshot,
  homeDashboard,
  homeMarket,
  rentalPriceStats,
  subscriptionDetail,
} from './housing-data.mjs'
import {
  emptySubscriptionListFixture,
  resetSubscriptionListFixture,
  shouldEmptySubscriptionListRequest,
  shouldFailSubscriptionListRequest,
  subscriptionListControl,
  subscriptionListFixture,
  subscriptionListRequests,
} from './subscription-list-data.mjs'

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

const ok = (res, data) => json(res, 200, { success: true, data })
const fail = (res, status, error) => json(res, status, { success: false, error })

const overviewRetryFailures = new Map()
const pageRetryFailures = new Map()
const nearbyRequests = []
const modeNavigationRequests = []
let failNextRegions = 0

function decrementFailure(map, key) {
  const remaining = map.get(key) ?? 0
  if (remaining <= 0) return false
  if (remaining === 1) map.delete(key)
  else map.set(key, remaining - 1)
  return true
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


function fixtureArea() {
  return {
    realEstate: {
      apt: {
        sale: { avg: 85000, count: 12 },
        rent: { avg: 50000, count: 8 },
      },
      villa: {
        sale: { avg: 52000, count: 6 },
        rent: { avg: 28000, count: 4 },
      },
      offitel: {
        sale: { avg: 41000, count: 5 },
        rent: { avg: 24000, count: 3 },
      },
    },
    facilities: {
      total: 7,
      categories: {
        hospital: 3,
        pharmacy: 2,
        parking: 1,
        subway: 1,
      },
      topCategories: ['hospital', 'pharmacy'],
    },
  }
}

const facility = {
  id: 'hospital-seo-fixture',
  name: '렌더링회복병원',
  category: 'hospital',
  address: '서울특별시 강남구 역삼동 123',
  roadAddress: '서울특별시 강남구 테헤란로 123',
  city: '서울특별시',
  district: '강남구',
  bjdCode: '1168010100',
  lat: 37.5,
  lng: 127.03,
  details: {
    clCdNm: '의원',
    phone: '02-1234-5678',
    departments: [{ dgsbjtCdNm: '내과', dgsbjtPrSdrCnt: 2 }],
    drTotCnt: 2,
  },
  sourceId: 'fixture',
  sourceUrl: null,
  viewCount: 1,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  syncedAt: '2026-08-01T00:00:00Z',
}

function statusResult(res, result, label) {
  if (result?.status === 404) return fail(res, 404, `${label} not found`)
  if (result?.status === 503) return fail(res, 503, `${label} unavailable`)
  return ok(res, result)
}

function delayedSubscriptionList(res, searchParams) {
  const send = () => {
    if (shouldFailSubscriptionListRequest(searchParams)) {
      subscriptionListRequests.push({
        ...Object.fromEntries(searchParams.entries()),
        failed: 'true',
      })
      return fail(res, 503, 'subscription list transient fixture failure')
    }
    if (shouldEmptySubscriptionListRequest(searchParams)) {
      return ok(res, emptySubscriptionListFixture(searchParams))
    }
    return ok(res, subscriptionListFixture(searchParams))
  }
  if (subscriptionListControl.delayMs > 0) {
    setTimeout(send, subscriptionListControl.delayMs)
    return undefined
  }
  return send()
}

const remainingPages = { domain: null, failNext: 0, delayMs: 0 }
const remainingBrowseRequests = []
const remainingWasteScheduleRequests = []

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  const name =
    url.searchParams.get('buildingName') ||
    decodeURIComponent(path.split('/').pop() || '') ||
    '회복아파트'

  if (path === '/health') return ok(res, { ok: true })
  if (path === '/__test/subscription-list/reset') {
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    resetSubscriptionListFixture()
    failNextRegions = 0
    return ok(res, { subscriptionListRequests: subscriptionListRequests.slice() })
  }
  if (path === '/__test/subscription-list/control') {
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    return readBody(req)
      .then((body) => {
        if (body.failNextList != null) {
          subscriptionListControl.failNextList = Number(body.failNextList)
          subscriptionListControl.failingListSignature = ''
        }
        if (body.emptyNextList != null) {
          subscriptionListControl.emptyNextList = Number(body.emptyNextList)
          subscriptionListControl.emptyListSignature = ''
        }
        if (body.failNextRegions != null) failNextRegions = Number(body.failNextRegions)
        if (body.delayMs != null) subscriptionListControl.delayMs = Number(body.delayMs)
        ok(res, {
          failNextList: subscriptionListControl.failNextList,
          failingListSignature: subscriptionListControl.failingListSignature,
          emptyNextList: subscriptionListControl.emptyNextList,
          emptyListSignature: subscriptionListControl.emptyListSignature,
          failNextRegions,
          delayMs: subscriptionListControl.delayMs,
          subscriptionListRequests: subscriptionListRequests.slice(),
        })
      })
      .catch((error) => fail(res, 400, error.message))
  }
  if (path === '/__fixture/control') {
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    return readBody(req)
      .then((body) => {
        if (body.reset) {
          overviewRetryFailures.clear()
          pageRetryFailures.clear()
          nearbyRequests.length = 0
        }
        for (const entry of body.overviewFailures ?? []) {
          overviewRetryFailures.set(`${entry.type}:${entry.name}`, Number(entry.count ?? 1))
        }
        for (const entry of body.pageFailures ?? []) {
          pageRetryFailures.set(
            `${entry.type}:${entry.name}:${entry.page}`,
            Number(entry.count ?? 1)
          )
        }
        ok(res, {
          overviewFailures: overviewRetryFailures.size,
          pageFailures: pageRetryFailures.size,
          nearbyRequests: nearbyRequests.slice(),
        })
      })
      .catch((error) => fail(res, 400, error.message))
  }
  if (path === '/__test/real-estate-mode-navigation') {
    if (req.method === 'GET') return ok(res, { requests: modeNavigationRequests.slice() })
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    modeNavigationRequests.length = 0
    return ok(res, { requests: [] })
  }
  if (path === '/__test/remaining-pages') {
    if (req.method === 'GET') return ok(res, {
      ...remainingPages,
      browseRequests: remainingBrowseRequests.slice(),
      wasteScheduleRequests: remainingWasteScheduleRequests.slice(),
    })
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    try {
      const body = await readBody(req)
      if (![null, 'lifestyle', 'property', 'editorial'].includes(body.domain)) return fail(res, 400, 'invalid domain')
      remainingBrowseRequests.length = 0
      remainingWasteScheduleRequests.length = 0
      remainingPages.domain = body.domain
      remainingPages.failNext = Math.max(0, Number(body.failNext) || 0)
      remainingPages.delayMs = Math.max(0, Math.min(5000, Number(body.delayMs) || 0))
      return ok(res, { ...remainingPages })
    } catch (error) { return fail(res, 400, error.message) }
  }
  if (path === '/__test/waste-area') {
    if (req.method === 'GET') return ok(res, wasteAreaFixtureState())
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    try {
      return ok(res, setWasteAreaFixtureControl(await readBody(req)))
    } catch (error) { return fail(res, 400, error.message) }
  }
  const wasteFixtureState = wasteAreaFixtureState()
  const wasteResult = wasteFixtureState.active ? handleWasteAreaFixture(url) : null
  if (wasteResult) {
    if (wasteFixtureState.delayMs) await new Promise(resolve => setTimeout(resolve, wasteFixtureState.delayMs))
    return json(res, wasteResult.status, wasteResult.body)
  }
  const remainingResult = remainingPages.domain === 'editorial' ? handleEditorialFixture(url) : remainingPages.domain === 'property' ? handlePropertyFixture(url) : remainingPages.domain === 'lifestyle' ? handleLifestyleFixture(url) : null
  if (remainingResult) {
    if (remainingPages.domain === 'lifestyle' && path === '/api/facilities/browse') remainingBrowseRequests.push(url.pathname + url.search)
    if (remainingPages.domain === 'lifestyle' && path === '/api/waste-schedules') {
      remainingWasteScheduleRequests.push(Object.fromEntries(url.searchParams.entries()))
    }
    if (remainingPages.delayMs) await new Promise(resolve => setTimeout(resolve, remainingPages.delayMs))
    if (remainingPages.failNext > 0) { remainingPages.failNext -= 1; return fail(res, 503, 'remaining fixture transient failure') }
    return json(res, remainingResult.status, remainingResult.body)
  }
  if (await handleExplorationRequest(req, res, url)) return
  if (path === '/api/meta/home-dashboard') return ok(res, homeDashboard())
  if (path === '/api/meta/regions') {
    if (failNextRegions > 0) {
      failNextRegions -= 1
      return fail(res, 503, 'regions transient fixture failure')
    }
    return ok(res, explorationRegions)
  }
  if (path === '/api/area/seoul/gangnam') return ok(res, fixtureArea())
  if (path === '/api/meta/sync-status') {
    return ok(res, {
      aptSale: '2026-09-01T00:00:00.000Z',
      aptRent: '2026-09-01T00:00:00.000Z',
      villaSale: '2026-09-01T00:00:00.000Z',
      villaRent: '2026-09-01T00:00:00.000Z',
      offitelSale: '2026-09-01T00:00:00.000Z',
      offitelRent: '2026-09-01T00:00:00.000Z',
    })
  }

  if (path === '/api/real-estate/home-market') {
    if (!url.searchParams.get('city') && url.searchParams.get('district'))
      return fail(res, 422, 'city is required with district')
    return ok(res, homeMarket(url.searchParams.get('city'), url.searchParams.get('district')))
  }

  const overviewMatch = path.match(/^\/api\/real-estate\/([^/]+)\/detail-overview$/)
  if (overviewMatch) {
    const retryKey = `${overviewMatch[1]}:${name}`
    if (decrementFailure(overviewRetryFailures, retryKey)) {
      return fail(res, 503, 'detail overview transient fixture failure')
    }
    return statusResult(res, detailOverview(overviewMatch[1], name), 'detail overview')
  }

  const detailMatch = path.match(/^\/api\/real-estate\/([^/]+)\/detail$/)
  if (detailMatch) {
    modeNavigationRequests.push({
      endpoint: 'detail',
      type: detailMatch[1],
      mode: url.searchParams.get('mode'),
      buildingName: url.searchParams.get('buildingName'),
      buildingKey: url.searchParams.get('buildingKey'),
      area: url.searchParams.get('area'),
      deposit: url.searchParams.get('deposit'),
    })
    return ok(res, detailSnapshot(detailMatch[1], url.searchParams))
  }

  const pageMatch = path.match(/^\/api\/real-estate\/([^/]+)\/detail-page$/)
  if (pageMatch) {
    const retryKey = `${pageMatch[1]}:${name}:${url.searchParams.get('page') ?? '1'}`
    if (decrementFailure(pageRetryFailures, retryKey)) {
      return fail(res, 503, 'detail page transient fixture failure')
    }
    modeNavigationRequests.push({
      endpoint: 'detail-page',
      type: pageMatch[1],
      mode: url.searchParams.get('mode'),
      buildingName: url.searchParams.get('buildingName'),
      buildingKey: url.searchParams.get('buildingKey'),
      area: url.searchParams.get('area'),
      deposit: url.searchParams.get('deposit'),
      page: url.searchParams.get('page'),
    })
    return ok(res, detailPage(pageMatch[1], url.searchParams))
  }

  if (
    path === '/api/real-estate/nearby' &&
    url.searchParams.get('excludeBuildingName') === '재시도아파트'
  ) {
    return fail(res, 503, 'SSR fixture transient failure')
  }
  if (path === '/api/real-estate/nearby') {
    nearbyRequests.push({
      mode: url.searchParams.get('mode'),
      rentType: url.searchParams.get('rentType'),
      excludeBuildingName: url.searchParams.get('excludeBuildingName'),
    })
    const excluded = url.searchParams.get('excludeBuildingName')
    if (excluded === '모호아파트') return ok(res, { apt: [], villa: [], offitel: [] })
    return ok(res, {
      apt: [baseBuilding('apt-sale', excluded === '이웃아파트' ? '회복아파트' : '이웃아파트')],
      villa: [baseBuilding('villa-sale', '이웃빌라')],
      offitel: [baseBuilding('offitel-sale', '이웃오피스텔')],
    })
  }

  const subscriptionStatsMatch = path.match(/^\/api\/subscription\/\d+\/rental-price-stats$/)
  if (subscriptionStatsMatch) return ok(res, rentalPriceStats())
  const subscriptionIdMatch = path.match(/^\/api\/subscription\/(\d+)$/)
  if (subscriptionIdMatch)
    return statusResult(res, subscriptionDetail(Number(subscriptionIdMatch[1])), 'subscription')
  if (path === '/api/subscription') return delayedSubscriptionList(res, url.searchParams)
  if (path === '/api/subscription/upcoming')
    return ok(res, subscriptionListFixture(new URLSearchParams('status=upcoming')).items)

  if (path === '/api/facilities/hospital/hospital-seo-fixture') return ok(res, facility)
  if (path.endsWith('/nearby-counts')) return ok(res, { radius: 300, counts: {} })
  if (path.includes('/guides') || path.includes('/blog') || path.endsWith('/search'))
    return ok(res, { items: [], total: 0 })
  if (path.endsWith('/price-analysis')) return ok(res, null)

  const realEstateType = path.match(/^\/api\/real-estate\/([^/]+)\//)?.[1] ?? 'apt-sale'
  const info = baseBuilding(realEstateType, name)
  if (path.endsWith('/complexes')) {
    if (info?.status === 503) return fail(res, 503, 'complexes unavailable')
    return ok(res, {
      items: info ? [info] : [],
      total: info ? 1 : 0,
      page: 1,
      totalPages: info ? 1 : 0,
    })
  }
  if (path.endsWith('/building-info')) {
    if (info?.status === 503) return fail(res, 503, 'building-info unavailable')
    return ok(res, info && url.searchParams.get('buildingKey')
      ? { ...info, buildingKey: url.searchParams.get('buildingKey') }
      : info)
  }
  if (path.endsWith('/stats')) {
    return ok(res, {
      monthly: [
        { year: 2026, month: 8, avgPrice: 85000, maxPrice: 87000, minPrice: 83000, count: 12 },
      ],
      summary: {
        recentAvg: 85000,
        previousAvg: 80000,
        changeRate: 6.25,
        totalCount: 12,
        lowVolume: false,
        priceLabel: '매매가',
      },
    })
  }
  if (path.endsWith('/area-groups'))
    return ok(res, [
      { area: 84.9, pyeong: 25, count: 21 },
      { area: 84.91, pyeong: 25, count: 2 },
    ])
  if (path.match(/\/real-estate\/[^/]+\/search$/))
    return ok(res, {
      items: detailSnapshot(realEstateType, url.searchParams).table.items,
      total: 21,
      page: 1,
      totalPages: 2,
    })

  return ok(res, {})
}).listen(18080, '127.0.0.1', () => console.log('SEO fixture API: 18080'))
