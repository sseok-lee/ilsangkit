import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateSitemapXml } from '../../server/utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  SITEMAP_FACILITY_CATEGORY_LIMITS,
  getSitemapFacilityLimit,
  isSitemapFacilityCategory,
} from '../../server/utils/sitemapPolicy'

describe('generateSitemapXml with images', () => {
  it('image 필드 없을 때 기존 동작과 동일 (하위 호환)', () => {
    const urls = [
      { loc: 'https://ilsangkit.co.kr/toilet', changefreq: 'daily' as const, priority: 0.8 },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/toilet</loc>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>0.8</priority>')
    expect(xml).not.toContain('<image:image>')
  })

  it('xmlns:image 네임스페이스가 urlset에 추가됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원 이미지',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
  })

  it('image.loc이 <image:image> 태그로 직렬화됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:image>')
    expect(xml).toContain('<image:loc>https://ilsangkit.co.kr/images/hospital.jpg</image:loc>')
    expect(xml).toContain('</image:image>')
  })

  it('image.title이 선택적으로 포함됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '서울 병원',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:title>서울 병원</image:title>')
  })

  it('image.caption이 선택적으로 포함됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '서울 병원',
          caption: '서울시 강남구 병원 외관',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<image:caption>서울시 강남구 병원 외관</image:caption>')
  })

  it('image 없는 URL과 있는 URL 혼합 시 각각 올바르게 처리', () => {
    const urls = [
      { loc: 'https://ilsangkit.co.kr/', priority: 1.0 },
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/hospital/1</loc>')
    expect(xml).toContain('<image:image>')
    // 첫 번째 URL 블록에는 image 태그 없어야 함
    const firstUrlBlock = xml.split('<url>')[1].split('</url>')[0]
    expect(firstUrlBlock).not.toContain('<image:image>')
  })

  it('image 필드의 특수문자가 XML 이스케이프됨', () => {
    const urls = [
      {
        loc: 'https://ilsangkit.co.kr/hospital/1',
        image: {
          loc: 'https://ilsangkit.co.kr/images/hospital.jpg',
          title: '병원 & 클리닉 <테스트>',
          caption: '"캡션" & \'설명\'',
        },
      },
    ]
    const xml = generateSitemapXml(urls)
    expect(xml).toContain('병원 &amp; 클리닉 &lt;테스트&gt;')
    expect(xml).toContain('&quot;캡션&quot; &amp; &apos;설명&apos;')
  })
})

describe('sitemapPolicy', () => {
  it('wifi와 aed는 사이트맵 대상 카테고리에 포함되지 않는다', () => {
    expect(isSitemapFacilityCategory('wifi')).toBe(false)
    expect(isSitemapFacilityCategory('aed')).toBe(false)
  })

  it('정책이 정의된 카테고리들이 SITEMAP_FACILITY_CATEGORIES 에 모두 등장한다', () => {
    for (const cat of Object.keys(SITEMAP_FACILITY_CATEGORY_LIMITS)) {
      expect(SITEMAP_FACILITY_CATEGORIES as readonly string[]).toContain(cat)
    }
  })

  it('getSitemapFacilityLimit 은 제외 카테고리에 대해 undefined 를 반환한다', () => {
    expect(getSitemapFacilityLimit('wifi')).toBeUndefined()
    expect(getSitemapFacilityLimit('aed')).toBeUndefined()
    // 제한이 없는 포함 카테고리도 undefined
    expect(getSitemapFacilityLimit('toilet')).toBeUndefined()
  })

  it('제한이 있는 카테고리는 정확한 정수 값을 돌려준다', () => {
    expect(getSitemapFacilityLimit('ev-charger')).toBe(20000)
    expect(getSitemapFacilityLimit('childcare')).toBe(15000)
    expect(getSitemapFacilityLimit('sports')).toBe(10000)
    expect(getSitemapFacilityLimit('clothes')).toBe(10000)
  })
})

/**
 * Index ↔ dynamic chunk handler coverage 일치 통합 테스트.
 * fetch를 모킹해 카테고리별 반환 개수를 제어한 뒤, 두 라우트가 동일한 청크 수를
 * 참조하는지 검증한다. "index에 2개 있으면 handler 는 page 1~2 만 200"을 회귀한다.
 */
describe('sitemap coverage parity (index ↔ dynamic chunk)', () => {
  const API_BASE = 'http://localhost:8000'

  // 카테고리별 전체 DB 행 수(limit 적용 전). ev-charger는 limit(20000)보다 훨씬 큼.
  const TOTAL_COUNTS: Record<string, number> = {
    toilet: 5,
    'ev-charger': 50000,
    childcare: 40000,
    sports: 25000,
    clothes: 30000,
    wifi: 1000, // index 제외
    aed: 500, // index 제외
  }

  function makeItems(count: number): { id: string; updatedAt: string }[] {
    const arr: { id: string; updatedAt: string }[] = []
    for (let i = 1; i <= count; i++) {
      arr.push({ id: String(i), updatedAt: '2026-04-01T00:00:00Z' })
    }
    return arr
  }

  function mockFetchImpl(url: string): Promise<Response> {
    const match = url.match(/\/api\/sitemap\/facilities\/([a-z-]+)(?:\?limit=(\d+))?/)
    if (match) {
      const category = match[1]
      const requestedLimit = match[2] ? parseInt(match[2], 10) : undefined
      const total = TOTAL_COUNTS[category] ?? 0
      const serveCount = requestedLimit !== undefined ? Math.min(total, requestedLimit) : total
      const data = makeItems(serveCount)
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (url.includes('/api/sitemap/waste-schedules')) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      )
    }
    if (url.includes('/api/sitemap/real-estate-buildings')) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      )
    }
    if (url.includes('/api/sitemap/subscriptions')) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
      )
    }
    return Promise.resolve(new Response('', { status: 404 }))
  }

  interface MockEvent {
    path: string
    node: { req: { url: string }; res: { setHeader: (name: string, value: string) => void } }
  }

  function createMockEvent(path: string): MockEvent {
    return {
      path,
      node: {
        req: { url: path },
        res: { setHeader: () => {} },
      },
    }
  }

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        mockFetchImpl(typeof input === 'string' ? input : String(input)),
      ) as unknown as typeof fetch
    // index route uses useRuntimeConfig(); setup.ts already mocks apiBase=http://localhost:8000
    // fetchFacilityIds caches by "facility:{category}:limit{n}"; ensure clean cache between tests.
    vi.resetModules()
  })

  afterEach(() => {
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
  })

  function countChunksForCategory(indexXml: string, category: string): number {
    // index entry forms: /sitemap/{cat}.xml  또는 /sitemap/{cat}-{n}.xml
    const singlePattern = new RegExp(`<loc>[^<]*?/sitemap/${category}\\.xml</loc>`, 'g')
    const pagedPattern = new RegExp(`<loc>[^<]*?/sitemap/${category}-(\\d+)\\.xml</loc>`, 'g')
    const singleMatches = indexXml.match(singlePattern) || []
    const pagedMatches = [...indexXml.matchAll(pagedPattern)].map((m) => parseInt(m[1], 10))
    if (singleMatches.length > 0) return 1
    if (pagedMatches.length === 0) return 0
    return Math.max(...pagedMatches)
  }

  it('index가 광고하는 ev-charger 청크 수와 handler가 200을 반환하는 청크 수가 일치한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    const advertised = countChunksForCategory(indexXml, 'ev-charger')
    // ev-charger limit=20000, MAX_URLS_PER_SITEMAP=10000 → 2 chunks
    expect(advertised).toBe(2)

    for (let page = 1; page <= advertised; page++) {
      const xml = await chunkHandler(
        createMockEvent(`/sitemap/ev-charger-${page}.xml`) as never,
      )
      expect(typeof xml).toBe('string')
      expect(xml as string).toContain('<urlset')
    }

    // page N+1 → 404
    await expect(
      chunkHandler(
        createMockEvent(`/sitemap/ev-charger-${advertised + 1}.xml`) as never,
      ),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('제한이 없는 단일-청크 카테고리(toilet)는 index에 1개, handler도 page 1만 200', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    const advertised = countChunksForCategory(indexXml, 'toilet')
    expect(advertised).toBe(1)

    const xml = await chunkHandler(createMockEvent('/sitemap/toilet.xml') as never)
    expect(xml as string).toContain('<urlset')

    await expect(
      chunkHandler(createMockEvent('/sitemap/toilet-2.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('/contact 은 static sitemap 에 포함된다 (US-006)', async () => {
    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const mockEvent: MockEvent = {
      path: '/sitemap/static.xml',
      node: {
        req: { url: '/sitemap/static.xml' },
        res: { setHeader: () => {} },
      },
    }
    const xml = (await staticHandler(mockEvent as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/contact</loc>')
  })

  it('가이드 100건 초과 시 모든 페이지가 static sitemap 에 포함된다 (pagination)', async () => {
    // fetch 를 가이드 page=1 에 101건(totalPages=2, page1=100, page2=1) 로 응답하게 설정.
    // 페이지네이션이 빠져 있다면 첫 요청만 100건 반환하고 101번째 slug 가 누락된다.
    const origFetch = globalThis.fetch
    const guideCounts: { page: number; slugs: string[] }[] = [
      {
        page: 1,
        slugs: Array.from({ length: 100 }, (_, i) => `guide-${i + 1}`),
      },
      {
        page: 2,
        slugs: ['guide-101'],
      },
    ]
    const totalPages = guideCounts.length
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : String(input)
        if (url.includes('/api/guides')) {
          const pageMatch = url.match(/page=(\d+)/)
          const page = pageMatch ? parseInt(pageMatch[1], 10) : 1
          const bucket = guideCounts.find((b) => b.page === page)
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: {
                  items: bucket
                    ? bucket.slugs.map((slug) => ({ slug, createdAt: '2026-04-01T00:00:00Z' }))
                    : [],
                  total: 101,
                  totalPages,
                  page,
                },
              }),
              { status: 200 },
            ),
          )
        }
        if (url.includes('/api/sitemap/region-categories')) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
          )
        }
        return Promise.resolve(new Response('', { status: 404 }))
      }) as unknown as typeof fetch

    try {
      vi.resetModules()
      const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
      const mockEvent: MockEvent = {
        path: '/sitemap/static.xml',
        node: {
          req: { url: '/sitemap/static.xml' },
          res: { setHeader: () => {} },
        },
      }
      const xml = (await staticHandler(mockEvent as never)) as string
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/guide/guide-1</loc>')
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/guide/guide-100</loc>')
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/guide/guide-101</loc>')
    } finally {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = origFetch
    }
  })

  it('wifi와 aed는 index에 노출되지 않고 handler는 404를 반환한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(indexXml).not.toMatch(/\/sitemap\/wifi(?:-\d+)?\.xml/)
    expect(indexXml).not.toMatch(/\/sitemap\/aed(?:-\d+)?\.xml/)

    await expect(
      chunkHandler(createMockEvent('/sitemap/wifi.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      chunkHandler(createMockEvent('/sitemap/aed-2.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('static sitemap 에 LH 임대 hub/탭 URL 들이 포함된다', async () => {
    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')

    const origFetch = globalThis.fetch
    ;(globalThis as unknown as { fetch: typeof fetch }).fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { items: [], pagination: { totalPages: 0 } } }), {
          status: 200,
        }),
      ) as unknown as typeof fetch
    try {
      const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/lh-rental</loc>')
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/lh-rental/buy-lease</loc>')
      expect(xml).toContain('<loc>https://ilsangkit.co.kr/lh-rental/charter</loc>')
      expect(xml).not.toContain('<loc>https://ilsangkit.co.kr/subscription/rent/buy-lease</loc>')
      expect(xml).not.toContain('<loc>https://ilsangkit.co.kr/subscription/rent/charter</loc>')
    } finally {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = origFetch
    }
  })
})
