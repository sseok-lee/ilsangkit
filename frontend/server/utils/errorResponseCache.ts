/**
 * 5xx 응답이 다운스트림 캐시(nginx proxy_cache·CDN)에 저장되지 않도록 강제한다.
 *
 * ## 왜 필요한가
 *
 * `markDegradedResponse()`(composables/useDegradedResponse.ts)는 SSR 일시 장애를
 * `503 + cache-control: no-store` 로 표시한다. no-store 는 "이 응답을 저장하지 마라"는
 * 뜻이고, 그래야 순간 장애 1회가 캐시 TTL 동안 고정 노출되지 않는다.
 *
 * 그런데 nuxt.config 의 `routeRules` swr 이 걸린 경로에서는 그 의도가 무력화된다.
 * Nitro 2.13.1 의 cachedEventHandler 는 핸들러가 무엇을 설정했든 상관없이
 * cache-control 을 **무조건 덮어쓴다**:
 *
 *   node_modules/nitropack/dist/runtime/internal/cache.mjs
 *     const cacheControl = []
 *     if (opts.swr) { ... cacheControl.push(`s-maxage=${opts.maxAge}`) ... }
 *     if (cacheControl.length > 0) {
 *       headers["cache-control"] = cacheControl.join(", ")   // ← no-store 파괴
 *     }
 *
 * 그 결과 503 이 `cache-control: s-maxage=600, stale-while-revalidate` 를 달고 나간다.
 * nginx 는 upstream 이 no-store 를 주면 캐시하지 않지만, 그 신호가 사라졌으므로
 * proxy_cache_valid 설정에 따라 5xx 를 저장할 수 있게 된다.
 *
 * 영향 경로 = swr routeRule 이 걸린 전부:
 *   시설 15개 카테고리 `/{category}/**` (swr 600)
 *   지역 허브 17개 시/도 `/{city}/**`   (swr 1800)
 *   `/real-estate/**`                   (swr 300)
 *
 * ## 무엇을 하지 않는가
 *
 * Nitro 자체 SWR 캐시는 이 문제가 없다 — 기본 validate 가 `entry.value.code >= 400`
 * 을 무효로 판정해 5xx 엔트리를 재서빙하지 않는다(같은 파일 defineCachedEventHandler).
 * 즉 고쳐야 하는 건 Nitro 내부 재서빙이 아니라 **바깥으로 나가는 헤더 계약**이다.
 *
 * 4xx 는 손대지 않는다. 404 가 캐시되는 것은 정상이고 바람직하다.
 */

/** beforeResponse 훅에서 다룰 수 있는 최소한의 응답 인터페이스. */
export interface CacheHeaderMutableResponse {
  statusCode: number
  headersSent: boolean
  setHeader(name: string, value: string): unknown
  removeHeader(name: string): void
}

/** 5xx 여서 캐시 금지를 강제해야 하는가. */
export function shouldForceNoStore(statusCode: number): boolean {
  return Number.isFinite(statusCode) && statusCode >= 500
}

/**
 * 5xx 면 `cache-control: no-store` 를 강제하고 캐시 검증자를 제거한다.
 * 적용했으면 true.
 *
 * etag/last-modified 는 Nitro cachedEventHandler 가 에러 응답에도 만들어 붙인다.
 * 남겨두면 다운스트림이 그 검증자로 재검증해 에러 본문을 되살릴 수 있으므로 함께 지운다.
 */
export function enforceNoStoreOnServerError(res: CacheHeaderMutableResponse): boolean {
  if (!shouldForceNoStore(res.statusCode)) return false
  // 이미 전송이 시작됐으면 헤더를 바꿀 수 없다(스트리밍 응답 등).
  if (res.headersSent) return false

  res.setHeader('cache-control', 'no-store')
  res.removeHeader('etag')
  res.removeHeader('last-modified')
  return true
}
