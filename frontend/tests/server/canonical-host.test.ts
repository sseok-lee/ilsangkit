import { describe, it, expect, beforeEach, vi } from 'vitest'

// h3 의 request helpers 를 테스트가 제어할 수 있는 상태 객체로 대체한다.
const mockState: {
  host: string
  url: URL
  lastRedirect: { url: string; status: number } | null
} = {
  host: '',
  url: new URL('https://ilsangkit.co.kr/'),
  lastRedirect: null,
}

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    defineEventHandler: (handler: (event: unknown) => unknown) => handler,
    getRequestHost: () => mockState.host,
    getRequestURL: () => mockState.url,
    sendRedirect: async (_event: unknown, url: string, status: number) => {
      mockState.lastRedirect = { url, status }
    },
  }
})

describe('canonical-host middleware', () => {
  let middleware: (event: unknown) => unknown

  beforeEach(async () => {
    mockState.lastRedirect = null
    vi.resetModules()
    const mod = await import('../../server/middleware/canonical-host')
    middleware = mod.default as (event: unknown) => unknown
  })

  async function invoke(host: string, pathname = '/', search = ''): Promise<void> {
    mockState.host = host
    mockState.url = new URL(`https://${host.includes(':') ? host : host}${pathname}${search}`)
    await middleware({})
  }

  it('apex 호스트(ilsangkit.co.kr) 요청은 리다이렉트하지 않는다', async () => {
    await invoke('ilsangkit.co.kr', '/toilet/123')
    expect(mockState.lastRedirect).toBeNull()
  })

  it('www.ilsangkit.co.kr 는 같은 path+query 를 유지하며 apex 로 301 리다이렉트된다', async () => {
    await invoke('www.ilsangkit.co.kr', '/real-estate/apt-sale', '?tab=sale')
    expect(mockState.lastRedirect).toEqual({
      url: 'https://ilsangkit.co.kr/real-estate/apt-sale?tab=sale',
      status: 301,
    })
  })

  it('www.ilsangkit.co.kr 루트 경로도 apex 로 301', async () => {
    await invoke('www.ilsangkit.co.kr', '/')
    expect(mockState.lastRedirect).toEqual({
      url: 'https://ilsangkit.co.kr/',
      status: 301,
    })
  })

  it('localhost 와 127.0.0.1 은 예외로 리다이렉트하지 않는다', async () => {
    await invoke('localhost:3000', '/search')
    expect(mockState.lastRedirect).toBeNull()
    await invoke('127.0.0.1:3000', '/search')
    expect(mockState.lastRedirect).toBeNull()
  })
})
