import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState: {
  url: URL
  lastRedirect: { url: string; status: number } | null
  statuses: number[]
  headers: Array<[string, string]>
} = {
  url: new URL('https://ilsangkit.co.kr/'),
  lastRedirect: null,
  statuses: [],
  headers: [],
}

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    defineEventHandler: (handler: (event: unknown) => unknown) => handler,
    getRequestURL: () => mockState.url,
    sendRedirect: async (_event: unknown, url: string, status: number) => {
      mockState.lastRedirect = { url, status }
    },
    setHeader: (_event: unknown, name: string, value: string) => {
      mockState.headers.push([name, value])
    },
    setResponseStatus: (_event: unknown, status: number) => {
      mockState.statuses.push(status)
    },
  }
})

describe('real-estate redirect middleware — unpublished hash suffix guard', () => {
  let middleware: (event: { respondWith: (response: Response) => Response }) => unknown
  let hasUnpublishedHashSuffix: (pathname: string) => boolean
  const originalRegionFlag = process.env.REGION_REORG_301

  beforeEach(async () => {
    mockState.lastRedirect = null
    mockState.statuses = []
    mockState.headers = []
    vi.resetModules()
    const mod = await import('../../server/middleware/real-estate-redirect')
    middleware = mod.default as typeof middleware
    hasUnpublishedHashSuffix = mod.hasUnpublishedHashSuffix
  })

  afterEach(() => {
    if (originalRegionFlag === undefined) delete process.env.REGION_REORG_301
    else process.env.REGION_REORG_301 = originalRegionFlag
  })

  async function invoke(pathname: string): Promise<Response | undefined> {
    mockState.url = new URL(`https://ilsangkit.co.kr${pathname}`)
    const event = {
      respondWith: (response: Response) => response,
    }
    return await middleware(event) as Response | undefined
  }

  it('detects only an extra 64-hex segment, not a base building name that happens to be hex-like', () => {
    const key = 'a'.repeat(64)
    expect(hasUnpublishedHashSuffix(`/real-estate/apt-sale/seoul/gangnam/${key}`)).toBe(false)
    expect(hasUnpublishedHashSuffix(`/real-estate/apt-sale/seoul/gangnam/building/${key}`)).toBe(true)
    expect(hasUnpublishedHashSuffix(`/real-estate/apt-sale/seoul/gangnam/building/${key.toUpperCase()}`)).toBe(true)
    expect(hasUnpublishedHashSuffix('/real-estate/apt-sale/seoul/gangnam/building/readable-address')).toBe(false)
  })

  it('returns 404 before REGION_REORG_301 can turn gwangju hash suffix into a 301', async () => {
    process.env.REGION_REORG_301 = '1'
    const response = await invoke(`/real-estate/apt-sale/gwangju/seo/building/${'a'.repeat(64)}`)

    expect(response?.status).toBe(404)
    expect(mockState.statuses).toContain(404)
    expect(mockState.lastRedirect).toBeNull()
    expect(mockState.headers).toContainEqual(['cache-control', 'no-store'])
  })

  it('returns 404 before broken district redirects, including uppercase hashes', async () => {
    const response = await invoke(`/real-estate/apt-sale/gyeonggi/hwaseong-%ED%9A%A8%ED%96%89%EA%B5%AC/building/${'B'.repeat(64)}`)

    expect(response?.status).toBe(404)
    expect(mockState.statuses).toContain(404)
    expect(mockState.lastRedirect).toBeNull()
  })
})
