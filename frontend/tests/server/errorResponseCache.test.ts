import { describe, it, expect } from 'vitest'
import {
  shouldForceNoStore,
  enforceNoStoreOnServerError,
  type CacheHeaderMutableResponse,
} from '~/server/utils/errorResponseCache'

/**
 * 회귀 배경: routeRules swr 이 걸린 경로에서 Nitro cachedEventHandler 가
 * cache-control 을 무조건 덮어써 markDegradedResponse() 의 no-store 를 파괴한다.
 * 그 결과 503 이 `s-maxage=600, stale-while-revalidate` 를 달고 나가 다운스트림
 * 캐시가 5xx 를 저장할 수 있게 된다.
 */

/** Nitro 가 swr 경로에서 실제로 붙이는 헤더를 재현한 가짜 응답. */
function makeRes(statusCode: number, opts: { headersSent?: boolean } = {}) {
  const headers = new Map<string, string>([
    ['cache-control', 's-maxage=600, stale-while-revalidate'],
    ['etag', 'W/"abc123"'],
    ['last-modified', 'Mon, 28 Jul 2026 00:00:00 GMT'],
  ])
  const res: CacheHeaderMutableResponse & { headers: Map<string, string> } = {
    statusCode,
    headersSent: opts.headersSent ?? false,
    headers,
    setHeader(name, value) {
      headers.set(name, String(value))
      return res
    },
    removeHeader(name) {
      headers.delete(name)
    },
  }
  return res
}

describe('shouldForceNoStore', () => {
  it.each([500, 502, 503, 504, 599])('%i 는 캐시 금지 대상', (code) => {
    expect(shouldForceNoStore(code)).toBe(true)
  })

  it.each([200, 301, 304, 404, 410, 422, 429, 499])('%i 는 손대지 않는다', (code) => {
    expect(shouldForceNoStore(code)).toBe(false)
  })

  it('404 가 캐시되는 것은 정상이므로 대상이 아니다', () => {
    expect(shouldForceNoStore(404)).toBe(false)
  })
})

describe('enforceNoStoreOnServerError', () => {
  it('503 이면 Nitro 가 덮어쓴 swr cache-control 을 no-store 로 되돌린다 (회귀 핵심)', () => {
    const res = makeRes(503)
    expect(res.headers.get('cache-control')).toBe('s-maxage=600, stale-while-revalidate')

    expect(enforceNoStoreOnServerError(res)).toBe(true)

    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('cache-control')).not.toContain('s-maxage')
    expect(res.headers.get('cache-control')).not.toContain('stale-while-revalidate')
  })

  it('에러 응답의 캐시 검증자를 제거해 재검증으로 되살아나지 못하게 한다', () => {
    const res = makeRes(500)
    enforceNoStoreOnServerError(res)
    expect(res.headers.has('etag')).toBe(false)
    expect(res.headers.has('last-modified')).toBe(false)
  })

  it('200 응답의 swr 캐시 헤더는 건드리지 않는다 — SWR 성능 이득을 깎지 않는다', () => {
    const res = makeRes(200)
    expect(enforceNoStoreOnServerError(res)).toBe(false)
    expect(res.headers.get('cache-control')).toBe('s-maxage=600, stale-while-revalidate')
    expect(res.headers.get('etag')).toBe('W/"abc123"')
  })

  it('404 도 건드리지 않는다', () => {
    const res = makeRes(404)
    expect(enforceNoStoreOnServerError(res)).toBe(false)
    expect(res.headers.get('cache-control')).toBe('s-maxage=600, stale-while-revalidate')
  })

  it('이미 전송이 시작된 응답은 헤더를 바꾸지 않는다', () => {
    const res = makeRes(503, { headersSent: true })
    expect(enforceNoStoreOnServerError(res)).toBe(false)
    expect(res.headers.get('cache-control')).toBe('s-maxage=600, stale-while-revalidate')
  })

  it('swr 이 없어 cache-control 이 애초에 없던 경로에서도 no-store 를 세운다', () => {
    const headers = new Map<string, string>()
    const res: CacheHeaderMutableResponse = {
      statusCode: 503,
      headersSent: false,
      setHeader(name, value) {
        headers.set(name, String(value))
        return res
      },
      removeHeader(name) {
        headers.delete(name)
      },
    }
    expect(enforceNoStoreOnServerError(res)).toBe(true)
    expect(headers.get('cache-control')).toBe('no-store')
  })

  it('비정상 statusCode 에는 반응하지 않는다', () => {
    const res = makeRes(Number.NaN)
    expect(enforceNoStoreOnServerError(res)).toBe(false)
  })
})
