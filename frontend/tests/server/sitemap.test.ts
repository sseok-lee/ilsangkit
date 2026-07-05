import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateSitemapXml } from '../../server/utils/sitemap'
import {
  SITEMAP_FACILITY_CATEGORIES,
  SITEMAP_FACILITY_CATEGORY_LIMITS,
  getSitemapFacilityLimit,
  isSitemapFacilityCategory,
} from '../../server/utils/sitemapPolicy'
import { ssrFetch } from '../../server/utils/ssrFetch'

vi.mock('../../server/utils/ssrFetch', () => ({
  ssrFetch: vi.fn(),
}))

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
  it('wifi는 noindex-only 상세 정책에 따라 사이트맵 대상 카테고리에 포함되지 않는다', () => {
    expect(isSitemapFacilityCategory('wifi')).toBe(false)
  })

  it('aed는 사이트맵 대상 카테고리에 포함된다', () => {
    expect(isSitemapFacilityCategory('aed')).toBe(true)
  })

  it('정책이 정의된 카테고리들이 SITEMAP_FACILITY_CATEGORIES 에 모두 등장한다', () => {
    for (const cat of Object.keys(SITEMAP_FACILITY_CATEGORY_LIMITS)) {
      expect(SITEMAP_FACILITY_CATEGORIES as readonly string[]).toContain(cat)
    }
  })

  it('getSitemapFacilityLimit 은 제외 카테고리에 대해 undefined 를 반환한다', () => {
    expect(getSitemapFacilityLimit('wifi')).toBeUndefined()
    // 제한이 없는 포함 카테고리도 undefined
    expect(getSitemapFacilityLimit('toilet')).toBeUndefined()
  })

  it('제한이 있는 카테고리는 정확한 정수 값을 돌려준다', () => {
    expect(getSitemapFacilityLimit('ev-charger')).toBe(20000)
    expect(getSitemapFacilityLimit('childcare')).toBe(15000)
    expect(getSitemapFacilityLimit('aed')).toBe(15000)
    expect(getSitemapFacilityLimit('sports')).toBe(10000)
    expect(getSitemapFacilityLimit('clothes')).toBe(10000)
  })
})

/**
 * Index ↔ dynamic chunk handler coverage 일치 통합 테스트.
 * ssrFetch를 모킹해 카테고리별 반환 개수를 제어한 뒤, 두 라우트가 동일한 청크 수를
 * 참조하는지 검증한다. "index에 2개 있으면 handler 는 page 1~2 만 200"을 회귀한다.
 */
describe('sitemap coverage parity (index ↔ dynamic chunk)', () => {
  // 카테고리별 전체 DB 행 수(limit 적용 전). ev-charger는 limit(20000)보다 훨씬 큼.
  const TOTAL_COUNTS: Record<string, number> = {
    toilet: 5,
    'ev-charger': 50000,
    childcare: 40000,
    sports: 25000,
    clothes: 30000,
    wifi: 1000, // noindex-only 상세 정책으로 index 제외
    aed: 20000,
  }

  function makeItems(count: number): { id: string; updatedAt: string }[] {
    const arr: { id: string; updatedAt: string }[] = []
    for (let i = 1; i <= count; i++) {
      arr.push({ id: String(i), updatedAt: '2026-04-01T00:00:00Z' })
    }
    return arr
  }

  function mockSsrFetchImpl(path: string): Promise<unknown> {
    const match = path.match(/\/api\/sitemap\/facilities\/([a-z-]+)(?:\?limit=(\d+))?/)
    if (match) {
      const category = match[1]
      const requestedLimit = match[2] ? parseInt(match[2], 10) : undefined
      const total = TOTAL_COUNTS[category] ?? 0
      const serveCount = requestedLimit !== undefined ? Math.min(total, requestedLimit) : total
      const data = makeItems(serveCount)
      return Promise.resolve({ success: true, data })
    }
    if (path.includes('/api/sitemap/waste-schedule-regions')) {
      return Promise.resolve({
        success: true,
        data: {
          regions: [
            { city: '서울특별시', district: '강남구', updatedAt: '2026-04-01T00:00:00Z' },
            { city: '경기도', district: '가평군', updatedAt: '2026-04-02T00:00:00Z' },
          ],
        },
      })
    }
    if (path.includes('/api/sitemap/waste-schedules')) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/real-estate-buildings')) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/real-estate-hubs')) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/subscriptions')) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/page-counts')) {
      // Throw to trigger fallback path in sitemap.xml index handler
      return Promise.reject(new Error('mock: page-counts unavailable'))
    }
    if (path.includes('/api/subway/stations')) {
      return Promise.resolve({ success: true, data: { items: [] } })
    }
    return Promise.reject(new Error(`mock: unhandled path ${path}`))
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

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(mockSsrFetchImpl as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  function countChunksForCategory(indexXml: string, category: string): number {
    // index entry forms: /sitemap/{cat}.xml  または /sitemap/{cat}-{n}.xml
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

  it('색인 대상인 aed는 index에 노출되고 handler도 chunk sitemap을 반환한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    const advertised = countChunksForCategory(indexXml, 'aed')
    expect(advertised).toBe(2)

    const firstChunk = await chunkHandler(createMockEvent('/sitemap/aed-1.xml') as never)
    expect(firstChunk as string).toContain('<loc>https://ilsangkit.co.kr/aed/1</loc>')
  })

  it('trash 사이트맵은 구·군 집계 URL만 내보내고 개별 /trash/[id]는 0건이다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/trash.xml') as never)) as string
    // buildTrashRegionPath 출력 = 개별 상세 301 타겟 = 집계 페이지 canonical (byte-match)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/seoul/gangnam/trash</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/gyeonggi/gapyeong/trash</loc>')
    // 개별 /trash/{id} 형태는 존재하지 않아야 한다
    expect(xml).not.toMatch(/\/trash\/\d+</)
  })

  it('trash 인덱스는 region 수(~250) 기준 단일 청크이고 trash-2는 404다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    const advertised = countChunksForCategory(indexXml, 'trash')
    expect(advertised).toBe(1)

    await expect(
      chunkHandler(createMockEvent('/sitemap/trash-2.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('/contact 은 static sitemap 에 포함된다 (US-006)', async () => {
    // static.xml uses ssrFetch directly; set up a simple mock that returns empty data
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)

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

    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        const pageMatch = path.match(/page=(\d+)/)
        const page = pageMatch ? parseInt(pageMatch[1], 10) : 1
        const bucket = guideCounts.find((b) => b.page === page)
        return Promise.resolve({
          data: {
            items: bucket
              ? bucket.slugs.map((slug) => ({ slug, createdAt: '2026-04-01T00:00:00Z' }))
              : [],
            total: 101,
            totalPages,
            page,
          },
        })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)

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
  })

  it('/article 목록 URL이 static sitemap에 포함된다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/articles')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)
    vi.resetModules()

    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/article</loc>')
  })

  it('발행 article이 없으면(0건) article 개별 URL 없이도 static sitemap이 정상 생성된다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/articles')) {
        return Promise.resolve({ data: { items: [], total: 0, page: 1, totalPages: 0 } })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)
    vi.resetModules()

    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).toContain('<urlset')
    expect(xml).not.toMatch(/\/article\/[a-z0-9-]+</)
  })

  it('발행 article이 100건을 초과하면 모든 페이지가 static sitemap에 포함된다 (pagination)', async () => {
    const articleCounts: { page: number; slugs: string[] }[] = [
      {
        page: 1,
        slugs: Array.from({ length: 100 }, (_, i) => `article-${i + 1}`),
      },
      {
        page: 2,
        slugs: ['article-101'],
      },
    ]
    const totalPages = articleCounts.length

    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/articles')) {
        const pageMatch = path.match(/page=(\d+)/)
        const page = pageMatch ? parseInt(pageMatch[1], 10) : 1
        const bucket = articleCounts.find((b) => b.page === page)
        return Promise.resolve({
          data: {
            items: bucket
              ? bucket.slugs.map((slug) => ({ slug, publishedAt: '2026-07-01T09:00:00.000Z' }))
              : [],
            total: 101,
            totalPages,
            page,
          },
        })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)
    vi.resetModules()

    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/article/article-1</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/article/article-100</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/article/article-101</loc>')
  })

  it('article의 lastmod는 publishedAt(YYYY-MM-DD)로 방출된다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/articles')) {
        return Promise.resolve({
          data: {
            items: [{ slug: 'issue-1', publishedAt: '2026-06-15T03:20:00.000Z' }],
            total: 1,
            page: 1,
            totalPages: 1,
          },
        })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)
    vi.resetModules()

    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/article/issue-1</loc>')
    expect(xml).toContain('<lastmod>2026-06-15</lastmod>')
  })

  it('wifi는 noindex-only 상세 정책에 따라 index에 노출되지 않고 handler는 404를 반환한다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')

    const indexXml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(indexXml).not.toMatch(/\/sitemap\/wifi(?:-\d+)?\.xml/)

    await expect(
      chunkHandler(createMockEvent('/sitemap/wifi.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('static sitemap 에 LH 임대 hub/탭 URL 들이 포함된다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: { facilities: [], subscriptions: { maxUpdatedAt: null } } })
      }
      if (path.includes('/api/guides')) {
        return Promise.resolve({ data: { items: [], totalPages: 0 } })
      }
      if (path.includes('/api/sitemap/region-categories')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)

    const { default: staticHandler } = await import('../../server/routes/sitemap/static.xml')
    const xml = (await staticHandler(createMockEvent('/sitemap/static.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/public-rental</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/public-rental/buy-lease</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/public-rental/charter</loc>')
    expect(xml).not.toContain('<loc>https://ilsangkit.co.kr/subscription/rent/buy-lease</loc>')
    expect(xml).not.toContain('<loc>https://ilsangkit.co.kr/subscription/rent/charter</loc>')
  })
})

describe('real-estate-hub sitemap (US-009 city/district hub URLs)', () => {
  const hubData = [
    { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구' },
    { realEstateType: 'villa-rent', city: '서울특별시', district: '강북구' },
  ]

  function mockSsrFetchWithHubs(path: string): Promise<unknown> {
    if (path.includes('/api/sitemap/real-estate-hubs')) {
      return Promise.resolve({ success: true, data: hubData })
    }
    if (path.includes('/api/sitemap/waste-schedule-regions')) {
      return Promise.resolve({ success: true, data: { regions: [] } })
    }
    if (
      path.includes('/api/sitemap/real-estate-buildings') ||
      path.includes('/api/sitemap/waste-schedules') ||
      path.includes('/api/sitemap/subscriptions')
    ) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/facilities/')) {
      return Promise.resolve({ success: true, data: [] })
    }
    if (path.includes('/api/sitemap/page-counts')) {
      return Promise.reject(new Error('mock: page-counts unavailable'))
    }
    if (path.includes('/api/subway/stations')) {
      return Promise.resolve({ success: true, data: { items: [] } })
    }
    return Promise.reject(new Error(`mock: unhandled path ${path}`))
  }

  interface MockEvent {
    path: string
    node: { req: { url: string }; res: { setHeader: (name: string, value: string) => void } }
  }

  function createMockEvent(path: string): MockEvent {
    return {
      path,
      node: { req: { url: path }, res: { setHeader: () => {} } },
    }
  }

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(mockSsrFetchWithHubs as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('real-estate-hub.xml에 district hub URL이 포함된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(
      createMockEvent('/sitemap/real-estate-hub.xml') as never,
    )) as string
    expect(xml).toContain('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam</loc>')
    expect(xml).toContain('https://ilsangkit.co.kr/real-estate/villa-rent/seoul/gangbuk</loc>')
  })

  it('real-estate-hub.xml에 city hub URL이 중복 없이 포함된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(
      createMockEvent('/sitemap/real-estate-hub.xml') as never,
    )) as string
    // apt-sale seoul city hub — 두 district가 같은 city이지만 apt-sale city hub는 1개
    const aptSeoulMatches = xml.match(
      /https:\/\/ilsangkit\.co\.kr\/real-estate\/apt-sale\/seoul<\/loc>/g,
    )
    expect(aptSeoulMatches).toHaveLength(1)
    // villa-rent seoul city hub
    expect(xml).toContain('https://ilsangkit.co.kr/real-estate/villa-rent/seoul</loc>')
  })

  it('sitemap index에 real-estate-hub.xml이 포함된다', async () => {
    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const xml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(xml).toContain('/sitemap/real-estate-hub.xml')
  })

  it('real-estate-hub.xml은 건물명 segment가 없는 URL만 포함한다 (5-segment URL 없음)', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(
      createMockEvent('/sitemap/real-estate-hub.xml') as never,
    )) as string
    // building URL pattern: /real-estate/{type}/{city}/{district}/{buildingName}
    expect(xml).not.toMatch(
      /https:\/\/ilsangkit\.co\.kr\/real-estate\/[^/]+\/[^/]+\/[^/]+\/[^<]+<\/loc>/,
    )
  })
})

describe('real-estate sitemap — invalid building name filtering', () => {
  const buildingData = [
    { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '래미안강남', bjdCode: '1168011700', lastmod: '2026-06-15' },
    { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '(535-3)', bjdCode: '1168011701', lastmod: '2026-06-15' },
    { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '123-4', bjdCode: '1168011702', lastmod: '2026-06-15' },
    { realEstateType: 'villa-rent', city: '부산광역시', district: '해운대구', buildingName: '해운대빌라', bjdCode: '2635011700', lastmod: '2026-03-01' },
  ]

  interface MockEvent {
    path: string
    node: { req: { url: string }; res: { setHeader: (name: string, value: string) => void } }
  }

  function createMockEvent(path: string): MockEvent {
    return { path, node: { req: { url: path }, res: { setHeader: () => {} } } }
  }

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/real-estate-buildings')) {
        return Promise.resolve({ success: true, data: buildingData })
      }
      return Promise.resolve({ success: true, data: [] })
    }) as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('유효하지 않은 건물명((숫자) 형태, 숫자-숫자 형태)은 사이트맵 URL에서 제외된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/real-estate.xml') as never)) as string
    expect(xml).toContain(encodeURIComponent('래미안강남'))
    expect(xml).toContain(encodeURIComponent('해운대빌라'))
    expect(xml).not.toContain('535-3')
    expect(xml).not.toContain('123-4')
  })

  it('유효한 건물만 포함되어 URL 수가 유효 건물 수와 일치한다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/real-estate.xml') as never)) as string
    const urlCount = (xml.match(/<url>/g) ?? []).length
    expect(urlCount).toBe(2)
  })

  it('건물별 최근 실거래월(item.lastmod)이 per-URL lastmod로 방출된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/real-estate.xml') as never)) as string
    expect(xml).toContain('<lastmod>2026-06-15</lastmod>')
    expect(xml).toContain('<lastmod>2026-03-01</lastmod>')
  })
})

describe('real-estate sitemap — lastmod fallback when backend omits lastmod', () => {
  interface MockEvent {
    path: string
    node: { req: { url: string }; res: { setHeader: (name: string, value: string) => void } }
  }
  function createMockEvent(path: string): MockEvent {
    return { path, node: { req: { url: path }, res: { setHeader: () => {} } } }
  }

  beforeEach(() => {
    // 구버전 백엔드 응답: lastmod 필드 없음 → weekStart 폴백 경로
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/real-estate-buildings')) {
        return Promise.resolve({
          success: true,
          data: [{ realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '래미안강남', bjdCode: '1168011700' }],
        })
      }
      return Promise.resolve({ success: true, data: [] })
    }) as typeof ssrFetch)
    vi.resetModules()
  })
  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('lastmod 누락 시 weekStart(YYYY-MM-DD)로 폴백해 항상 유효한 lastmod를 방출한다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const { getWeekStartDate } = await import('../../server/utils/sitemap')
    const xml = (await chunkHandler(createMockEvent('/sitemap/real-estate.xml') as never)) as string
    expect(xml).toContain(`<lastmod>${getWeekStartDate()}</lastmod>`)
  })
})

describe('land sitemap — isIndexable quality gate', () => {
  interface MockEvent {
    path: string
    node: { req: { url: string }; res: { setHeader: (name: string, value: string) => void } }
  }

  function createMockEvent(path: string): MockEvent {
    return { path, node: { req: { url: path }, res: { setHeader: () => {} } } }
  }

  const landData = {
    cities: [
      { city: '서울', district: '강남구' },
      { city: '서울', district: '강북구' },
      { city: '경기', district: '성남시분당구' },
    ],
    indexableDongs: [
      { city: '서울', district: '강남구', dongName: '역삼동' },
      { city: '서울', district: '강남구', dongName: '삼성동' },
      // 강북구 has no indexable dongs — its dong URLs must be absent
    ],
  }

  function mockSsrFetchWithLand(path: string): Promise<unknown> {
    if (path.includes('/api/real-estate/land/sitemap')) {
      return Promise.resolve({ success: true, data: landData })
    }
    return Promise.resolve({ success: true, data: [] })
  }

  beforeEach(() => {
    vi.mocked(ssrFetch).mockImplementation(mockSsrFetchWithLand as typeof ssrFetch)
    vi.resetModules()
  })

  afterEach(() => {
    vi.mocked(ssrFetch).mockReset()
  })

  it('land.xml에 hub URL이 포함된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/land.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/real-estate/land</loc>')
  })

  it('land.xml에 모든 city hub URL이 포함된다 (seenCityUrls 중복 제거)', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/land.xml') as never)) as string
    // 서울 city hub — 두 district가 같은 city이지만 city hub는 1개
    const seoulCityMatches = xml.match(/https:\/\/ilsangkit\.co\.kr\/real-estate\/land\/seoul<\/loc>/g)
    expect(seoulCityMatches).toHaveLength(1)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/real-estate/land/gyeonggi</loc>')
  })

  it('land.xml에 모든 district URL이 포함된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/land.xml') as never)) as string
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/real-estate/land/seoul/gangnam</loc>')
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/real-estate/land/seoul/gangbuk</loc>')
    // 성남시분당구 has no slug mapping → toDistrictSlug returns the Korean string as-is (lowercased)
    expect(xml).toContain('<loc>https://ilsangkit.co.kr/real-estate/land/gyeonggi/성남시분당구</loc>')
  })

  it('isIndexable=true인 동 URL이 포함된다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/land.xml') as never)) as string
    expect(xml).toContain(encodeURIComponent('역삼동'))
    expect(xml).toContain(encodeURIComponent('삼성동'))
  })

  it('isIndexable=false인 동(강북구)의 dong URL은 포함되지 않는다 — 품질 게이트', async () => {
    // fetchLandSitemap only returns indexable dongs; 강북구 has none in the mock
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/land.xml') as never)) as string
    // Any dong URL under gangbuk should be absent
    expect(xml).not.toMatch(/real-estate\/land\/seoul\/gangbuk\//)
  })

  it('sitemap index에 land.xml이 포함된다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.reject(new Error('mock: page-counts unavailable'))
      }
      if (path.includes('/api/real-estate/land/sitemap')) {
        return Promise.resolve({ success: true, data: landData })
      }
      if (path.includes('/api/sitemap/real-estate-buildings')) {
        return Promise.resolve({ success: true, data: [] })
      }
      if (path.includes('/api/sitemap/real-estate-hubs')) {
        return Promise.resolve({ success: true, data: [] })
      }
      if (path.includes('/api/sitemap/subscriptions')) {
        return Promise.resolve({ success: true, data: [] })
      }
      if (path.includes('/api/sitemap/facilities/')) {
        return Promise.resolve({ success: true, data: [] })
      }
      if (path.includes('/api/sitemap/waste-schedule-regions')) {
        return Promise.resolve({ success: true, data: { regions: [] } })
      }
      if (path.includes('/api/sitemap/waste-schedules')) {
        return Promise.resolve({ success: true, data: [] })
      }
      if (path.includes('/api/subway/stations')) {
        return Promise.resolve({ success: true, data: { items: [] } })
      }
      return Promise.reject(new Error(`mock: unhandled path ${path}`))
    }) as typeof ssrFetch)
    vi.resetModules()

    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const xml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(xml).toContain('/sitemap/land.xml')
  })
})
