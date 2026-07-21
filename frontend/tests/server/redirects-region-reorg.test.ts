import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Task A7 — redirects.ts 미들웨어 통합 테스트.
 *
 * resolveRegionReorgRedirect 단위 테스트(region-reorg-redirect.test.ts)에 더해,
 * 실제 default-export 핸들러가 env 플래그를 읽어 올바른 순서로 301을 발동/미발동하는지,
 * 그리고 기존 suffix 리다이렉트 로직과 공존하는지 검증한다.
 */

const mockState: {
  url: URL
  lastRedirect: { url: string; status: number } | null
} = {
  url: new URL('https://ilsangkit.co.kr/'),
  lastRedirect: null,
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
  }
})

describe('redirects middleware — region reorg 통합', () => {
  let middleware: (event: unknown) => unknown
  const originalFlag = process.env.REGION_REORG_301

  beforeEach(async () => {
    mockState.lastRedirect = null
    vi.resetModules()
    const mod = await import('../../server/middleware/redirects')
    middleware = mod.default as (event: unknown) => unknown
  })

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.REGION_REORG_301
    else process.env.REGION_REORG_301 = originalFlag
  })

  function invoke(pathname: string, search = ''): Promise<unknown> {
    mockState.url = new URL(`https://ilsangkit.co.kr${pathname}${search}`)
    return Promise.resolve(middleware({}))
  }

  describe('REGION_REORG_301 미설정(기본 OFF)', () => {
    beforeEach(() => {
      delete process.env.REGION_REORG_301
    })

    it('bare city hub 는 리다이렉트되지 않는다', async () => {
      await invoke('/gwangju')
      expect(mockState.lastRedirect).toBeNull()
    })

    it('시설 지역 URL 도 리다이렉트되지 않는다', async () => {
      await invoke('/gwangju/서구/toilet')
      expect(mockState.lastRedirect).toBeNull()
    })
  })

  describe("REGION_REORG_301='1' (명시적 ON)", () => {
    beforeEach(() => {
      process.env.REGION_REORG_301 = '1'
    })

    it('bare city hub: /gwangju → /jeonnamgwangju 301', async () => {
      await invoke('/gwangju')
      expect(mockState.lastRedirect).toEqual({ url: '/jeonnamgwangju', status: 301 })
    })

    it('bare city hub: /jeonnam → /jeonnamgwangju 301 (query 보존)', async () => {
      await invoke('/jeonnam', '?tab=map')
      expect(mockState.lastRedirect).toEqual({ url: '/jeonnamgwangju?tab=map', status: 301 })
    })

    it('시설 지역: /gwangju/{district}/toilet → district·category 불변', async () => {
      // 주의: 한글 세그먼트의 byte-match 보존은 pure function 단위 테스트(region-reorg-redirect.test.ts)에서
      // 리터럴 문자열로 직접 검증한다 — 여기서는 브라우저와 동일하게 new URL()로 pathname 을 만들기 때문에
      // WHATWG URL 이 비-ASCII 세그먼트를 자동 percent-encode 해 리터럴 비교가 왜곡된다. 라우팅/순서/플래그
      // 검증에는 ASCII 세그먼트로 충분하다.
      await invoke('/gwangju/district-x/toilet')
      expect(mockState.lastRedirect).toEqual({
        url: '/jeonnamgwangju/district-x/toilet',
        status: 301,
      })
    })

    it('jeonnamgwangju 자체 요청은 리다이렉트되지 않는다', async () => {
      await invoke('/jeonnamgwangju/서구/toilet')
      expect(mockState.lastRedirect).toBeNull()
    })

    it('기존 -gu/-si/-gun suffix 리다이렉트와 공존한다(무회귀)', async () => {
      await invoke('/seoul/gangnam-gu')
      expect(mockState.lastRedirect).toEqual({ url: '/seoul/gangnam', status: 301 })
    })

    it('REGION_REORG_301 이 아닌 다른 값이면 미발동', async () => {
      process.env.REGION_REORG_301 = 'true'
      await invoke('/gwangju')
      expect(mockState.lastRedirect).toBeNull()
    })
  })
})
