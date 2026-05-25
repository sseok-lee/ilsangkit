import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock #imports (Nuxt) — useRuntimeConfig must return NCP credentials
vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ ncpMapClientId: 'test-id', ncpMapClientSecret: 'test-secret' }),
  defineEventHandler: (fn: any) => fn,
  getQuery: (event: any) => event.__query,
  setHeader: (event: any, k: string, v: string) => event.__headers.set(k, v),
}))

// Also mock h3 to use the same shims (the handler file imports from 'h3')
vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getQuery: (event: any) => event.__query,
  setHeader: (event: any, k: string, v: string) => event.__headers.set(k, v),
}))

// Mock sharp to avoid native binding requirement in test env
vi.mock('sharp', () => ({
  default: () => ({ png: () => ({ toBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]) }) }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function mockEvent(query: Record<string, string>) {
  return {
    __query: query,
    __headers: new Map<string, string>(),
    node: { req: {}, res: { statusCode: 200 } },
    context: {},
  } as any
}

describe('og-map.get handler', () => {
  let handler: any
  const baseQuery = { lat: '35.17', lng: '126.91', label: '새한A', category: 'apt', title: 'test', city: '광주', district: '북구' }

  beforeEach(async () => {
    fetchMock.mockReset()
    vi.resetModules()
    const mod = await import('../../server/routes/og-map.get')
    handler = mod.default
  })

  it('NCP 성공 → PNG 200', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    })
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeInstanceOf(Buffer)
    expect(event.__headers.get('Content-Type')).toBe('image/png')
    expect(event.node.res.statusCode).not.toBe(302)
  })

  it('NCP 4xx → inline fallback 200 (302 아님)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
    const ct = event.__headers.get('Content-Type')
    expect(['image/png', 'image/svg+xml']).toContain(ct)
  })

  it('NCP exception → inline fallback 200', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'))
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
  })

  it('좌표 무효 → inline fallback 200, NCP 호출 없음', async () => {
    const event = mockEvent({ ...baseQuery, lat: '999', lng: '999' })
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
