// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createApp, toNodeListener } from 'h3'
import { readFileSync } from 'node:fs'

const runtime = vi.hoisted(() => ({ base: '' }))
vi.mock('../../server/utils/internalApiBase', () => ({ getInternalApiBase: () => runtime.base }))
import handler from '../../server/api/[...]'

const servers: Server[] = []
async function listen(server: Server) {
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}

describe('runtime API proxy with real HTTP upstreams', () => {
  let frontend: string
  let first: string
  let second: string
  beforeAll(async () => {
    const upstream = (release: string) => createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = req.url?.startsWith('/api/missing') ? 404 : 200
      res.end(JSON.stringify({ release, url: req.url, method: req.method, body: Buffer.concat(chunks).toString() }))
    })
    first = await listen(upstream('first'))
    second = await listen(upstream('second'))
    frontend = await listen(createServer(toNodeListener(createApp().use(handler))))
  })
  afterAll(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => {
      server.close(() => resolve())
      server.closeAllConnections()
    })))
  })

  it('preserves POST body and encoded queries without relying on port 8000', async () => {
    runtime.base = first
    const body = JSON.stringify({ category: 'hospital', keyword: '성원' })
    const response = await fetch(`${frontend}/api/facilities/search?city=%EC%84%9C%EC%9A%B8`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ release: 'first', url: '/api/facilities/search?city=%EC%84%9C%EC%9A%B8', method: 'POST', body })
  })

  it('resolves the runtime target instead of keeping a build-time backend', async () => {
    runtime.base = second
    const response = await fetch(`${frontend}/api/area/seoul`)
    expect((await response.json()).release).toBe('second')
  })

  it('preserves upstream failures instead of presenting success', async () => {
    runtime.base = first
    const response = await fetch(`${frontend}/api/missing?id=1`)
    expect(response.status).toBe(404)
    expect((await response.json()).url).toBe('/api/missing?id=1')
  })

  it('does not let a static route rule override the runtime handler', () => {
    const source = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/['"]\/api\/\*\*['"]\s*:\s*\{\s*proxy:/)
  })
})
