import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateSitemapXml, generateSitemapIndexXml, SITE_URL, sitemapLocDropReason } from '../../server/utils/sitemap'
import { rejectSitemapLoc, SITEMAP_LOC_ORIGIN, SITEMAP_FACILITY_CATEGORIES, SITEMAP_FACILITY_CATEGORY_LIMITS } from '../../server/utils/sitemapPolicy'
import { resolveRegionReorgRedirect } from '../../server/middleware/redirects'
import { resolveRegionReorgCityRedirect } from '../../server/middleware/real-estate-redirect'
import { ssrFetch } from '../../server/utils/ssrFetch'
import REDIRECTS from '../../server/data/facilityRedirects.json'

vi.mock('../../server/utils/ssrFetch', () => ({
  ssrFetch: vi.fn(),
}))

/**
 * 사이트맵 <loc> 품질 게이트.
 *
 * 2026-09-04 네이버 서치어드바이저 실측: 리다이렉트 3,193 · 접근불가(4xx/410) 523 ·
 * soft-404 25 · 일 수집량 33,000 → 3,000. 사이트맵은 우리가 크롤러에게 직접 건네는
 * 목록이라, 여기 들어간 나쁜 URL 은 전부 크롤 예산에서 곧장 빠져나간다.
 */

interface MockEvent {
  path: string
  node: {
    req: { url: string }
    res: { setHeader: (name: string, value: string) => void; statusCode?: number }
  }
}

function createMockEvent(path: string): MockEvent {
  return { path, node: { req: { url: path }, res: { setHeader: () => {} } } }
}

function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
}

// ─────────────────────────────────────────────────────────────────────────────
// 순수 규칙
// ─────────────────────────────────────────────────────────────────────────────

describe('rejectSitemapLoc — <loc> 하드 게이트', () => {
  it('origin 상수는 utils/sitemap.ts 의 SITE_URL 과 같아야 한다', () => {
    // 순환 import 회피로 두 곳에 선언돼 있다. 어긋나면 게이트가 전부 origin 으로 오탈락한다.
    expect(SITEMAP_LOC_ORIGIN).toBe(SITE_URL)
  })

  it('정상 URL 은 통과한다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}`)).toBeNull()
    expect(rejectSitemapLoc(`${SITE_URL}/`)).toBeNull() // 홈은 슬래시 유무 둘 다 200
    expect(rejectSitemapLoc(`${SITE_URL}/toilet`)).toBeNull()
    expect(rejectSitemapLoc(`${SITE_URL}/seoul/gangnam/trash`)).toBeNull()
    expect(rejectSitemapLoc(`${SITE_URL}/real-estate/apt-sale/seoul/gangnam/%EB%9E%98%EB%AF%B8%EC%95%88`)).toBeNull()
  })

  it('쿼리 문자열이 붙은 URL 은 전부 거부한다', () => {
    for (const q of ['?schedule=1', '?page=2', '?usage=apt', '?city=seoul']) {
      expect(rejectSitemapLoc(`${SITE_URL}/trash${q}`)).toBe('query')
    }
  })

  it('fragment · 후행 슬래시는 거부한다 (redirects.ts 가 301 한다)', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/toilet#top`)).toBe('fragment')
    expect(rejectSitemapLoc(`${SITE_URL}/toilet/`)).toBe('trailing-slash')
  })

  it('빈 path 세그먼트는 거부한다 — trashDistrictSlug 가 매핑 미스 때 빈 문자열을 돌려준다', () => {
    // shared/regionSlugs.ts trashDistrictSlug: DISTRICT_SLUG_MAP 미스 → 한글 전부 제거 → ''
    expect(rejectSitemapLoc(`${SITE_URL}/gyeonggi//trash`)).toBe('empty-segment')
    expect(rejectSitemapLoc(`${SITE_URL}//gangnam/trash`)).toBe('empty-segment')
  })

  it('percent-encoding 되지 않은 한글은 거부한다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/real-estate/land/gyeonggi/성남시분당구`)).toBe('non-ascii')
    expect(rejectSitemapLoc(`${SITE_URL}/toilet/서울역`)).toBe('non-ascii')
  })

  it('공백 등 미인코딩 문자는 거부한다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/guide/hello world`)).toBe('unsafe-char')
  })

  it('OG 이미지 엔드포인트는 거부한다 — 프로덕션에서 302 다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/og-map`)).toBe('og-endpoint')
    expect(rejectSitemapLoc(`${SITE_URL}/og-map/seoul`)).toBe('og-endpoint')
    // 쿼리가 먼저 걸려도 어느 쪽이든 거부이면 된다
    expect(rejectSitemapLoc(`${SITE_URL}/og?title=a`)).not.toBeNull()
    expect(rejectSitemapLoc(`${SITE_URL}/og-map?lat=37&lng=127`)).not.toBeNull()
  })

  it('우리 origin 이 아닌 URL 은 거부한다', () => {
    expect(rejectSitemapLoc('https://example.com/toilet')).toBe('origin')
    expect(rejectSitemapLoc('/toilet')).toBe('origin')
    expect(rejectSitemapLoc('https://ilsangkit.co.kr.evil.com/toilet')).toBe('origin')
  })
})

describe('legacy 광주/전남 slug — 리다이렉트 미들웨어와 판정이 일치해야 한다', () => {
  // deploy.yml 이 REGION_REORG_301=1 을 내보내므로 프로덕션에서 두 slug 는 301 이다.
  // 게이트가 미들웨어보다 좁으면 사이트맵이 301 URL 을 계속 제출하게 된다.
  const regionPaths = ['/gwangju', '/jeonnam', '/gwangju/dong/toilet', '/jeonnam/mokpo']
  const realEstatePaths = [
    '/real-estate/apt-sale/gwangju/dong',
    '/real-estate/villa-rent/jeonnam/mokpo',
  ]

  it('지역 형태 URL 은 미들웨어가 301 하는 것과 동일하게 거부된다', () => {
    for (const path of regionPaths) {
      expect(resolveRegionReorgRedirect(path, '', true)).not.toBeNull()
      expect(rejectSitemapLoc(`${SITE_URL}${path}`)).toBe('legacy-city-slug')
    }
  })

  it('부동산 형태 URL 은 real-estate-redirect 가 301 하는 것과 동일하게 거부된다', () => {
    for (const path of realEstatePaths) {
      expect(resolveRegionReorgCityRedirect(path, true)).not.toBeNull()
      expect(rejectSitemapLoc(`${SITE_URL}${path}`)).toBe('legacy-city-slug')
    }
  })

  it('신 slug(jeonnamgwangju)는 통과한다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/jeonnamgwangju/mokpo/toilet`)).toBeNull()
    expect(rejectSitemapLoc(`${SITE_URL}/real-estate/apt-sale/jeonnamgwangju/mokpo`)).toBeNull()
  })

  it('경기광주(gyeonggi/gwangju)는 city 자리가 아니므로 통과한다', () => {
    expect(rejectSitemapLoc(`${SITE_URL}/gyeonggi/gwangju/toilet`)).toBeNull()
  })
})

describe('고아 시설 301 매핑 — sitemapLocDropReason', () => {
  const [orphanId, currentId] = Object.entries(REDIRECTS as Record<string, string>)[0]
  const category = orphanId.split('-')[0]

  it('facility-redirect 가 301 하는 id 는 거부한다', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/${category}/${orphanId}`)).toBe('facility-301')
  })

  it('301 타겟(현행 id)은 통과한다', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/${category}/${currentId}`)).toBeNull()
  })

  it('매핑에 없는 id 는 통과한다', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/${category}/${category}-ffffffffffff`)).toBeNull()
  })
})

describe('generateSitemapXml — 게이트를 우회할 수 없다', () => {
  it('부적격 URL 은 조용히 고쳐지지 않고 항목째 빠진다', () => {
    const xml = generateSitemapXml([
      { loc: `${SITE_URL}/toilet/toilet-abc`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/trash?schedule=3`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/gyeonggi//trash`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/real-estate/land/gyeonggi/성남시분당구`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/og-map?lat=37`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/gwangju/dong/toilet`, lastmod: '2026-09-01' },
    ])
    const locs = locsOf(xml)
    expect(locs).toEqual([`${SITE_URL}/toilet/toilet-abc`])
    // 쿼리를 떼서 살려두면 안 된다 — 그 URL 을 만든 호출부의 버그가 숨는다
    expect(locs).not.toContain(`${SITE_URL}/trash`)
  })

  it('같은 URL 이 두 번 들어오면 한 번만 방출한다', () => {
    const xml = generateSitemapXml([
      { loc: `${SITE_URL}/toilet`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/toilet`, lastmod: '2026-08-01' },
    ])
    expect(locsOf(xml)).toEqual([`${SITE_URL}/toilet`])
  })

  it('image:loc 이 부적격이면 URL 은 살리고 image 블록만 뗀다', () => {
    const xml = generateSitemapXml([
      {
        loc: `${SITE_URL}/toilet/toilet-abc`,
        image: { loc: `${SITE_URL}/og-map?lat=37&lng=127` },
      },
    ])
    expect(xml).toContain(`<loc>${SITE_URL}/toilet/toilet-abc</loc>`)
    expect(xml).not.toContain('<image:image>')
    expect(xml).not.toContain('og-map')
  })

  it('사이트맵 인덱스 loc 도 같은 게이트를 통과한다', () => {
    const xml = generateSitemapIndexXml([
      { loc: `${SITE_URL}/sitemap/toilet.xml`, lastmod: '2026-09-01' },
      { loc: `${SITE_URL}/sitemap/toilet.xml?page=2`, lastmod: '2026-09-01' },
    ])
    expect(locsOf(xml)).toEqual([`${SITE_URL}/sitemap/toilet.xml`])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 라우트 통합
// ─────────────────────────────────────────────────────────────────────────────

/** 사이트맵 전체에 걸어야 하는 불변식. 어느 청크든 이걸 어기면 크롤 예산이 샌다. */
function assertSitemapInvariants(xml: string): void {
  for (const loc of locsOf(xml)) {
    expect(loc.startsWith(`${SITE_URL}/`) || loc === SITE_URL).toBe(true)
    expect(loc).not.toContain('?')
    expect(loc).not.toContain('#')
    // origin 뒤에 '//' 가 있으면 빈 세그먼트 — 매칭되는 라우트가 없다
    expect(loc.slice(SITE_URL.length)).not.toContain('//')
    expect(/[^\x20-\x7E]/.test(loc)).toBe(false)
    expect(loc).not.toMatch(/\/og(-map)?(\/|$)/)
  }
}

describe('사이트맵 라우트 — 게이트 통합', () => {
  const REDIRECTING_IDS = Object.keys(REDIRECTS as Record<string, string>).filter((id) =>
    id.startsWith('toilet-'),
  )

  const wasteRegions = [
    { city: '서울특별시', district: '강남구', updatedAt: '2026-09-01T00:00:00Z' },
    // DISTRICT_SLUG_MAP 에 없는 구 — trashDistrictSlug 가 '' 를 돌려줘 `/gyeonggi//trash` 가 된다
    { city: '경기도', district: '성남시분당구', updatedAt: '2026-09-02T00:00:00Z' },
    // 폐지 slug(gwangju) — REGION_REORG_301 이 301 한다
    { city: '광주광역시', district: '동구', updatedAt: '2026-09-02T00:00:00Z' },
  ]

  function baseMock(path: string): Promise<unknown> {
    const facilityMatch = path.match(/\/api\/sitemap\/facilities\/([a-z-]+)/)
    if (facilityMatch) {
      if (facilityMatch[1] !== 'toilet') return Promise.resolve({ success: true, data: [] })
      return Promise.resolve({
        success: true,
        data: [
          { id: 'toilet-cleanid0001', updatedAt: '2026-09-01T00:00:00Z' },
          ...REDIRECTING_IDS.slice(0, 3).map((id) => ({ id, updatedAt: '2026-09-01T00:00:00Z' })),
        ],
      })
    }
    if (path.includes('/api/sitemap/waste-schedule-regions')) {
      return Promise.resolve({ success: true, data: { regions: wasteRegions } })
    }
    if (path.includes('/api/auction/sitemap') || path.includes('/api/auction')) {
      return Promise.resolve({
        success: true,
        data: {
          // 백엔드는 isIndexable=true 로 이미 거른 뒤 그 컬럼을 select 에서 뺀다
          regions: [
            { city: '서울특별시', district: '강남구', bjdCode: '1168000000', usageGroup: 'apt' },
            { city: '서울특별시', district: '강남구', bjdCode: '1168000000', usageGroup: 'land' },
            { city: '부산광역시', district: '해운대구', bjdCode: '2635000000', usageGroup: 'apt' },
          ],
          items: ['1234567', '7654321'],
        },
      })
    }
    if (path.includes('/api/sitemap/page-counts')) {
      return Promise.resolve({
        data: {
          facilities: [{ category: 'toilet', count: 4, maxUpdatedAt: '2026-09-01' }],
          waste: { count: 3, maxUpdatedAt: '2026-09-02' },
          subscriptions: { count: 0, maxUpdatedAt: null },
          realEstateBuildings: { count: 0, maxUpdatedAt: null },
        },
      })
    }
    if (path.includes('/api/guides') || path.includes('/api/articles')) {
      return Promise.resolve({ data: { items: [], totalPages: 0 } })
    }
    if (path.includes('/api/sitemap/region-categories')) {
      return Promise.resolve({
        data: [
          { city: '서울특별시', district: '강남구', citySlug: 'seoul', districtSlug: 'gangnam', category: 'toilet' },
          { city: '서울특별시', district: '강남구', citySlug: 'seoul', districtSlug: 'gangnam', category: 'trash' },
          // 폐지 slug — 게이트가 걸러야 한다
          { city: '광주광역시', district: '동구', citySlug: 'gwangju', districtSlug: 'dong', category: 'toilet' },
        ],
      })
    }
    return Promise.resolve({ success: true, data: [] })
  }

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(baseMock as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('시설 청크에 301 대상 고아 id 가 없다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/toilet.xml') as never)) as string

    expect(xml).toContain(`<loc>${SITE_URL}/toilet/toilet-cleanid0001</loc>`)
    for (const id of REDIRECTING_IDS.slice(0, 3)) {
      expect(xml).not.toContain(id)
    }
    assertSitemapInvariants(xml)
  })

  it('trash 청크는 빈 세그먼트·폐지 slug URL 을 내보내지 않는다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/trash.xml') as never)) as string

    expect(locsOf(xml)).toEqual([`${SITE_URL}/seoul/gangnam/trash`])
    expect(xml).not.toContain('/gyeonggi//trash')
    expect(xml).not.toContain('/gwangju/')
    assertSitemapInvariants(xml)
  })

  it('static.xml 은 trash 지역 URL 을 내보내지 않는다 — 소유자는 trash 청크다', async () => {
    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const staticXml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    const trashXml = (await chunkHandler(createMockEvent('/sitemap/trash.xml') as never)) as string

    const regionTrashUrl = `${SITE_URL}/seoul/gangnam/trash`
    expect(trashXml).toContain(`<loc>${regionTrashUrl}</loc>`)
    expect(staticXml).not.toContain(`<loc>${regionTrashUrl}</loc>`)

    // 카테고리 랜딩 `/trash` 는 static 이 계속 소유한다 (지역 URL 과 다른 페이지)
    expect(staticXml).toContain(`<loc>${SITE_URL}/trash</loc>`)

    // 두 사이트맵 사이에 중복 loc 이 없어야 한다
    const overlap = locsOf(staticXml).filter((loc) => locsOf(trashXml).includes(loc))
    expect(overlap).toEqual([])
    assertSitemapInvariants(staticXml)
  })

  it('static.xml 에 폐지 city slug(gwangju) URL 이 없다', async () => {
    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).not.toContain(`<loc>${SITE_URL}/gwangju</loc>`)
    expect(xml).not.toContain(`<loc>${SITE_URL}/gwangju/dong/toilet</loc>`)
    expect(xml).toContain(`<loc>${SITE_URL}/seoul/gangnam/toilet</loc>`)
  })

  it('auction 청크가 지역 URL 을 실제로 내보낸다 (isIndexable 이중 게이트 회귀)', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/auction.xml') as never)) as string

    // 종전에는 백엔드가 select 하지 않는 isIndexable 을 재검사해 전 행이 탈락, 0건이었다
    expect(xml).toContain(`<loc>${SITE_URL}/auction/seoul/gangnam</loc>`)
    expect(xml).toContain(`<loc>${SITE_URL}/auction/busan/haeundae</loc>`)
    // usageGroup 이 달라도 같은 시군구는 1건
    expect(locsOf(xml).filter((l) => l === `${SITE_URL}/auction/seoul/gangnam`)).toHaveLength(1)
    expect(xml).toContain(`<loc>${SITE_URL}/auction/item/1234567</loc>`)
    assertSitemapInvariants(xml)
  })

  it('인덱스가 auction.xml 을 광고한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const xml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(xml).toContain(`<loc>${SITE_URL}/sitemap/auction.xml</loc>`)
    assertSitemapInvariants(xml)
  })

  it('어떤 청크에도 /og · /og-map 이 등장하지 않는다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')

    const xmls = await Promise.all([
      chunkHandler(createMockEvent('/sitemap/toilet.xml') as never),
      chunkHandler(createMockEvent('/sitemap/trash.xml') as never),
      chunkHandler(createMockEvent('/sitemap/auction.xml') as never),
      staticHandler(createMockEvent('/sitemap/static.xml') as never),
      indexHandler(createMockEvent('/sitemap.xml') as never),
    ])
    for (const xml of xmls) {
      expect(xml as string).not.toContain('/og-map')
      expect(xml as string).not.toMatch(/<loc>[^<]*\/og(\?|<|\/)/)
    }
  })
})

describe('빈 page 1 은 fail-closed (503) — 빈 sitemap 이 디스크로 구워지는 것을 막는다', () => {
  /**
   * 회귀 대상: 상류 fetch 실패 → items 0건 → totalPages = Math.max(1, 0) = 1 →
   * `page > totalPages` 가 거짓 → 형식만 멀쩡한 빈 <urlset> 이 200 으로 나가고,
   * 정적 baker 가 그걸 디스크에 구워 빈 상태를 동결시켰다.
   */
  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation((() =>
      Promise.reject(new Error('mock: upstream down'))) as unknown as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  const cases: Array<[string, string]> = [
    ['시설', '/sitemap/toilet.xml'],
    ['trash', '/sitemap/trash.xml'],
    ['부동산 건물', '/sitemap/real-estate.xml'],
    ['부동산 허브', '/sitemap/real-estate-hub.xml'],
    ['청약', '/sitemap/subscription.xml'],
    ['지하철', '/sitemap/subway.xml'],
  ]

  for (const [label, path] of cases) {
    it(`${label} page 1 이 0건이면 200 빈 urlset 이 아니라 503 이다`, async () => {
      const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
      const event = createMockEvent(path)
      const body = (await chunkHandler(event as never)) as string

      expect(event.node.res.statusCode).toBe(503)
      expect(body).not.toContain('<urlset')
      expect(body).not.toContain('<html')
    })
  }

  it('503 응답에는 no-store 가 붙는다 (캐시·베이크 방지)', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const headers: Record<string, string> = {}
    const event = createMockEvent('/sitemap/toilet.xml')
    event.node.res.setHeader = (name: string, value: string) => {
      headers[name.toLowerCase()] = value
    }
    await chunkHandler(event as never)
    expect(headers['cache-control']).toBe('no-store')
  })
})

describe('.xml 요청의 404 본문은 최소 XML 이다', () => {
  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation((() =>
      Promise.resolve({ success: true, data: [] })) as unknown as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('존재하지 않는 카테고리는 26KB HTML 에러 페이지가 아니라 짧은 XML 을 돌려준다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const event = createMockEvent('/sitemap/nosuchcategory.xml')
    const body = (await chunkHandler(event as never)) as string

    expect(event.node.res.statusCode).toBe(404)
    expect(body).not.toContain('<html')
    expect(body).not.toContain('<urlset')
    expect(body.length).toBeLessThan(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// index ↔ handler ↔ backend 정책 일치
// ─────────────────────────────────────────────────────────────────────────────

describe('사이트맵 정책 단일 소스', () => {
  /**
   * `/sitemap/childcare-5.xml` · `/sitemap/wifi-3.xml` · `/sitemap/ev-charger-4.xml` 처럼
   * "인덱스는 광고하는데 핸들러는 404" 인 청크가 생기는 경로는 하나다 —
   * 인덱스가 쓰는 건수(backend page-counts)와 핸들러가 쓰는 건수(frontend 조회)에
   * 서로 다른 상한이 적용될 때. 두 상한 표는 물리적으로 다른 파일에 있으므로,
   * 통합할 수 없다면 최소한 어긋남이 테스트로 드러나야 한다.
   */
  // vitest root 는 frontend/ 다. 백엔드 소스를 텍스트로 읽어 상수 표를 비교한다 —
  // 서버·DB 없이 두 파일의 어긋남만 감지하는 게 목적이라 파싱으로 충분하다.
  const backendSrc = readFileSync(
    resolve(process.cwd(), '../backend/src/services/sitemapService.ts'),
    'utf-8',
  )

  function parseBackendCategories(): string[] {
    const block = backendSrc.match(/SITEMAP_FACILITY_CATS[^=]*=\s*\[([\s\S]*?)\]/)
    expect(block).not.toBeNull()
    return [...(block as RegExpMatchArray)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
  }

  function parseBackendLimits(): Record<string, number> {
    const block = backendSrc.match(/SITEMAP_FACILITY_LIMITS[^=]*=\s*\{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()
    const out: Record<string, number> = {}
    for (const m of (block as RegExpMatchArray)[1].matchAll(/'?([a-z-]+)'?\s*:\s*(\d+)/g)) {
      out[m[1]] = Number(m[2])
    }
    return out
  }

  it('backend SITEMAP_FACILITY_CATS 와 frontend SITEMAP_FACILITY_CATEGORIES 가 같다', () => {
    expect([...parseBackendCategories()].sort()).toEqual([...SITEMAP_FACILITY_CATEGORIES].sort())
  })

  it('backend SITEMAP_FACILITY_LIMITS 와 frontend SITEMAP_FACILITY_CATEGORY_LIMITS 가 같다', () => {
    // 여기가 어긋나면 인덱스 청크 수 ≠ 핸들러 청크 수 → 광고했는데 404 인 사이트맵이 생긴다
    expect(parseBackendLimits()).toEqual(SITEMAP_FACILITY_CATEGORY_LIMITS)
  })

  it('파싱이 실제로 값을 읽어냈다 (정규식이 조용히 빈 결과를 내지 않는지)', () => {
    expect(parseBackendCategories().length).toBeGreaterThan(5)
    expect(Object.keys(parseBackendLimits()).length).toBeGreaterThan(0)
  })
})

describe('인덱스가 광고하는 청크는 전부 핸들러가 200 으로 서빙한다', () => {
  // 카테고리별 DB 행 수(limit 적용 전)
  const TOTAL_COUNTS: Record<string, number> = {
    toilet: 5,
    'ev-charger': 50000,
    childcare: 40000,
    sports: 25000,
    clothes: 30000,
    aed: 20000,
  }

  function mockImpl(path: string): Promise<unknown> {
    const m = path.match(/\/api\/sitemap\/facilities\/([a-z-]+)(?:\?limit=(\d+))?/)
    if (m) {
      const total = TOTAL_COUNTS[m[1]] ?? 100
      const limit = m[2] ? parseInt(m[2], 10) : undefined
      const serve = limit !== undefined ? Math.min(total, limit) : total
      return Promise.resolve({
        success: true,
        data: Array.from({ length: serve }, (_, i) => ({
          id: `${m[1]}-${i + 1}`,
          updatedAt: '2026-09-01T00:00:00Z',
        })),
      })
    }
    if (path.includes('/api/sitemap/waste-schedule-regions')) {
      return Promise.resolve({
        success: true,
        data: { regions: [{ city: '서울특별시', district: '강남구', updatedAt: '2026-09-01T00:00:00Z' }] },
      })
    }
    if (path.includes('/api/sitemap/page-counts')) {
      return Promise.reject(new Error('mock: page-counts unavailable'))
    }
    if (path.includes('/api/subway/stations')) {
      return Promise.resolve({ success: true, data: { items: [] } })
    }
    return Promise.resolve({ success: true, data: [] })
  }

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(mockImpl as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('시설 카테고리 청크 URL 이 인덱스와 핸들러에서 일치한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    const advertised = locsOf(indexXml)
      .map((loc) => loc.replace(`${SITE_URL}/sitemap/`, '').replace('.xml', ''))
      .filter((slug) => SITEMAP_FACILITY_CATEGORIES.some((c) => slug === c || slug.startsWith(`${c}-`)))

    expect(advertised.length).toBeGreaterThan(0)

    for (const slug of advertised) {
      const event = createMockEvent(`/sitemap/${slug}.xml`)
      const body = (await chunkHandler(event as never)) as string
      expect(event.node.res.statusCode, `advertised chunk ${slug} must be 200`).toBeUndefined()
      expect(body).toContain('<urlset')
    }
  })

  it('마지막 청크 다음 번호는 404 다 (인덱스가 광고하지 않는 번호)', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    // ev-charger limit=20000, MAX_URLS_PER_SITEMAP=10000 → 2청크
    const event = createMockEvent('/sitemap/ev-charger-3.xml')
    await chunkHandler(event as never)
    expect(event.node.res.statusCode).toBe(404)
  })
})
