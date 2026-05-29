import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ssrFetch } from '../../server/utils/ssrFetch'

vi.mock('../../server/utils/ssrFetch', () => ({ ssrFetch: vi.fn() }))

interface MockEvent {
  path: string
  node: { req: { url: string }; res: { setHeader: (n: string, v: string) => void } }
}
function createMockEvent(path: string): MockEvent {
  return { path, node: { req: { url: path }, res: { setHeader: () => {} } } }
}

beforeEach(() => {
  vi.mocked(ssrFetch).mockImplementation(((path: string) => {
    if (path.includes('/api/sitemap/public-rental-announcements')) {
      return Promise.resolve({
        data: [
          { pblancId: '2026 001/특수', updatedAt: '2026-05-29T01:00:00Z' },
          { pblancId: 'PBL-2', updatedAt: '2026-05-28T01:00:00Z' },
        ],
      })
    }
    return Promise.reject(new Error(`unhandled ${path}`))
  }) as typeof ssrFetch)
  vi.resetModules()
})
afterEach(() => vi.mocked(ssrFetch).mockReset())

describe('sitemap chunk: public-rental-announcements', () => {
  it('announcement 상세 URL을 encodeURIComponent로 발행한다', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    const xml = (await chunkHandler(createMockEvent('/sitemap/public-rental-announcements.xml') as never)) as string
    expect(xml).toContain('<urlset')
    expect(xml).toContain(`/public-rental/announcements/${encodeURIComponent('2026 001/특수')}`)
    expect(xml).toContain('/public-rental/announcements/PBL-2')
    expect(xml).not.toContain('/public-rental/announcements/2026 001/특수')
  })

  it('알 수 없는 slug는 404', async () => {
    const { default: chunkHandler } = await import('../../server/routes/sitemap/[...]')
    await expect(
      chunkHandler(createMockEvent('/sitemap/public-rental-bogus.xml') as never),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('index가 public-rental-announcements 청크를 광고한다', async () => {
    vi.mocked(ssrFetch).mockImplementation(((path: string) => {
      if (path.includes('/api/sitemap/page-counts')) {
        return Promise.resolve({ data: {
          facilities: [], waste: { count: 0, maxUpdatedAt: null },
          subscriptions: { count: 0, maxUpdatedAt: null },
          realEstateBuildings: { count: 0, maxUpdatedAt: null },
        } })
      }
      if (path.includes('/api/sitemap/public-rental-announcements')) {
        return Promise.resolve({ data: [{ pblancId: 'PBL-1', updatedAt: '2026-05-29T01:00:00Z' }] })
      }
      if (path.includes('/api/subway/stations')) return Promise.resolve({ data: { items: [] } })
      return Promise.resolve({ data: [] })
    }) as typeof ssrFetch)

    const { default: indexHandler } = await import('../../server/routes/sitemap.xml')
    const xml = (await indexHandler(createMockEvent('/sitemap.xml') as never)) as string
    expect(xml).toContain('/sitemap/public-rental-announcements.xml')
  })
})
