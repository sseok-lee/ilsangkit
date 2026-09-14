import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OG_MAP_WIDTH, OG_MAP_HEIGHT, OG_MAP_CONTENT_TYPE } from '../../utils/ogMapSpec'

// 라우트는 useRuntimeConfig 를 Nuxt auto-import(전역)로 쓴다 — '#imports' 를 mock 해도 닿지 않는다.
// tests/setup.ts 의 전역 스텁에는 NCP 자격증명이 없어서, 자격증명이 없으면 곧장 inlineFallback 으로
// 빠지는 라우트 특성상 이 파일의 모든 테스트가 NCP 경로를 한 번도 타지 않고 있었다.
// 두 경로가 모두 Buffer + image/png 를 돌려주는 바람에 'NCP 성공 → PNG 200' 이 계속 통과했다.
// 전역을 직접 덮어써야 실제 NCP 경로가 검증된다.
const originalRuntimeConfig = (globalThis as any).useRuntimeConfig
const originalUseStorage = (globalThis as any).useStorage
const sharpState = vi.hoisted(() => ({ fail: false }))
const staticFallbackPng = readFileSync(resolve(process.cwd(), 'public/og-image.png'))

// Also mock h3 to use the same shims (the handler file imports from 'h3')
vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getQuery: (event: any) => event.__query,
  setHeader: (event: any, k: string, v: string) => event.__headers.set(k, v),
}))

// Mock sharp to avoid native binding requirement in test env
vi.mock('sharp', () => ({
  default: () => {
    if (sharpState.fail) throw new Error('sharp unavailable')
    return { png: () => ({ toBuffer: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]) }) }
  },
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
    sharpState.fail = false
    ;(globalThis as any).useRuntimeConfig = () => ({
      ncpMapClientId: 'test-id',
      ncpMapClientSecret: 'test-secret',
      public: {},
    })
    ;(globalThis as any).useStorage = () => ({
      getItemRaw: async () => staticFallbackPng,
    })
    vi.resetModules()
    const mod = await import('../../server/routes/og-map.get')
    handler = mod.default
  })

  afterEach(() => {
    vi.useRealTimers()
    ;(globalThis as any).useRuntimeConfig = originalRuntimeConfig
    ;(globalThis as any).useStorage = originalUseStorage
  })

  it('자격증명이 없으면 NCP 를 호출하지 않고 inline fallback 으로 간다', async () => {
    // 이 분기가 나머지 테스트를 조용히 무력화하고 있었다 — 회귀 시 즉시 드러나게 고정한다.
    ;(globalThis as any).useRuntimeConfig = () => ({ public: {} })
    vi.resetModules()
    const mod = await import('../../server/routes/og-map.get')
    const event = mockEvent(baseQuery)
    const result = await mod.default(event)
    expect(result).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(event.__headers.get('X-OG-Map-Cache')).toBe('FALLBACK')
  })

  it('NCP 성공 → JPEG 200', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
    })
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeInstanceOf(Buffer)
    expect(event.__headers.get('Content-Type')).toBe(OG_MAP_CONTENT_TYPE)
    expect(event.node.res.statusCode).not.toBe(302)
  })

  it('NCP 요청 규격이 og:image 선언값과 일치한다 (1배율)', async () => {
    // 최초 커밋(f74abc66)부터 라우트는 scale:2 로 2048x1072 를 내보내는데
    // useFacilityMeta 는 og:image:width/height 를 1024x536 으로 선언하고 있었다.
    // 소셜 플랫폼은 선언값으로 카드 레이아웃을 잡은 뒤 4배 픽셀을 받는 상태였다.
    // scale 을 1 로 되돌려야 선언값과 실제 출력이 일치한다.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer,
    })
    await handler(mockEvent(baseQuery))

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('w')).toBe(String(OG_MAP_WIDTH))
    expect(url.searchParams.get('h')).toBe(String(OG_MAP_HEIGHT))
    expect(url.searchParams.get('scale')).toBe('1')
    expect(url.searchParams.get('center')).toBe('126.91,35.17')
  })

  it('NCP 에 JPEG 를 요청한다 — 지도 래스터에 PNG 는 비효율적', async () => {
    // 실측(2026-08-26): 동일 이미지 기준 PNG 837KB → JPEG 147KB (-82%).
    // Yeti 는 robots 에서 og-map 을 차단하지 않으므로(네이버가 og:image 를 렌더링에 사용)
    // 네이버 크롤 비용과 카카오톡·네이버 공유 미리보기 속도가 여기서 개선된다.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer,
    })
    await handler(mockEvent(baseQuery))

    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('format')).toBe('jpg')
  })

  it('같은 지도 요청은 서버 캐시에 적중해 NCP 를 다시 호출하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x01]).buffer,
    })

    const first = await handler(mockEvent({ ...baseQuery, label: '새한|A' }))
    const secondEvent = mockEvent({ ...baseQuery, label: '새한:A' })
    const second = await handler(secondEvent)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(Buffer.compare(first, second)).toBe(0)
    expect(secondEvent.__headers.get('X-OG-Map-Cache')).toBe('HIT')
  })

  it('성공 캐시는 만료 후 새 NCP 응답으로 갱신한다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T00:00:00Z'))
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x01]).buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x02]).buffer,
      })

    const first = await handler(mockEvent(baseQuery))
    const cached = await handler(mockEvent(baseQuery))
    vi.setSystemTime(new Date('2026-09-15T00:00:01Z'))
    const refreshed = await handler(mockEvent(baseQuery))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(Buffer.compare(first, cached)).toBe(0)
    expect(Buffer.compare(first, refreshed)).not.toBe(0)
    vi.useRealTimers()
  })

  it('동시에 들어온 같은 키 요청은 한 번의 NCP 호출을 공유한다', async () => {
    let resolveFetch: ((value: any) => void) | undefined
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const first = handler(mockEvent(baseQuery))
    const second = handler(mockEvent({ ...baseQuery, label: '새한|A' }))
    resolveFetch?.({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x03]).buffer,
    })

    const results = await Promise.all([first, second])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(Buffer.compare(results[0], results[1])).toBe(0)
  })

  it('성공·적중·fallback 상태를 X-OG-Map-Cache 헤더로 노출한다', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x04]).buffer,
    })

    const missEvent = mockEvent(baseQuery)
    await handler(missEvent)
    const hitEvent = mockEvent(baseQuery)
    await handler(hitEvent)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502 })
    const fallbackEvent = mockEvent({ ...baseQuery, lat: '35.170001' })
    await handler(fallbackEvent)

    expect(missEvent.__headers.get('X-OG-Map-Cache')).toBe('MISS')
    expect(hitEvent.__headers.get('X-OG-Map-Cache')).toBe('HIT')
    expect(fallbackEvent.__headers.get('X-OG-Map-Cache')).toBe('FALLBACK')
  })

  it('NCP 요청에는 AbortSignal 이 붙고 timeout 뒤 정적 PNG fallback 으로 끝난다', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      const signal = init?.signal
      if (!signal) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff]).buffer,
        })
      }
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    })

    const event = mockEvent(baseQuery)
    const resultPromise = handler(event)
    await vi.advanceTimersByTimeAsync(2500)
    const result = await resultPromise

    expect(fetchMock.mock.calls[0][1]?.signal).toBeTruthy()
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true)
    expect(result).toBeInstanceOf(Buffer)
    expect(event.__headers.get('Content-Type')).toBe('image/png')
    expect(event.__headers.get('Cache-Control')).not.toContain('86400')
    vi.useRealTimers()
  })

  it('timeout 은 headers 이후 body 소비 지연에도 적용된다', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      const signal = init?.signal
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(Object.assign(new Error('body timeout'), { name: 'AbortError' })))
        }),
      })
    })

    const event = mockEvent({ ...baseQuery, lat: '35.170002' })
    const resultPromise = handler(event)
    const pendingSentinel = new Promise((resolve) => setTimeout(() => resolve('pending'), 1))
    await vi.advanceTimersByTimeAsync(2500)
    await vi.advanceTimersByTimeAsync(1)
    const result = await Promise.race([resultPromise, pendingSentinel])

    expect(result).not.toBe('pending')
    expect(event.__headers.get('Content-Type')).toBe('image/png')
    expect(event.__headers.get('X-OG-Map-Cache')).toBe('FALLBACK')
    vi.useRealTimers()
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
    sharpState.fail = true
    const event = mockEvent({ ...baseQuery, lat: '999', lng: '999' })
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(event.__headers.get('Content-Type')).toBe('image/png')
  })

  /**
   * 폴백 카드는 category 키로 라벨·색을 고른다. 옛 구현은 모르는 키를 전부 'apt' 로 떨어뜨려
   * 공매 물건·청약 단지·지하철역이 모두 '아파트 실거래가' 카드로 렌더됐다 — 비어 보이는 게
   * 아니라 사실과 다른 라벨을 붙이는 상태였다.
   */
  describe('normalizeOgCategory — 폴백 카드 라벨', () => {
    let normalizeOgCategory: (raw: string) => string

    beforeEach(async () => {
      const mod = await import('../../server/routes/og-map.get')
      normalizeOgCategory = mod.normalizeOgCategory
    })

    it('부동산 slug 는 대표 키로 접는다', () => {
      expect(normalizeOgCategory('apt-rent')).toBe('apt')
      expect(normalizeOgCategory('offitel-sale')).toBe('offitel')
    })

    it('시설 카테고리 키는 그대로 통과한다 (지하철역 포함)', () => {
      expect(normalizeOgCategory('toilet')).toBe('toilet')
      expect(normalizeOgCategory('subway')).toBe('subway')
    })

    it('SPECIAL 키(area)는 아파트로 둔갑하지 않는다', () => {
      expect(normalizeOgCategory('area')).toBe('area')
    })

    it('라벨이 없는 도메인(공매·청약)은 아파트가 아니라 도메인 중립 키로 간다', () => {
      expect(normalizeOgCategory('auction')).not.toBe('apt')
      expect(normalizeOgCategory('subscription')).not.toBe('apt')
    })
  })
})
