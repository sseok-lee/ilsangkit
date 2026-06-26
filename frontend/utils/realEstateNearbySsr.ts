import type { NearbyResponse } from '~/types/realEstate'

function emptyNearby(): NearbyResponse {
  return { apt: [], villa: [], offitel: [] }
}

/**
 * SSR 전용 best-effort 인근 단지 로더.
 *
 * 인근 단지 섹션은 SEO·내부링크용 보조 콘텐츠다. 이 페이지는 2026-06 Prisma 풀고갈
 * 시 SSR이 fail-closed로 noindex를 굳혀버린 사고 경로이므로, 보조 데이터의 실패/지연이
 * **절대 페이지를 throw시키거나 noindex로 뒤집어선 안 된다**(SSR fail-open 정책,
 * [[project_ssr_noindex_pool_exhaustion]]).
 *
 * 이 래퍼는 (1) 로더 rejection → 빈 결과, (2) timeout(기본 4s) 초과 → 빈 결과로
 * 처리하고 절대 throw하지 않으며 렌더를 매달지 않는다.
 */
export async function fetchNearbyForSsr(
  loader: () => Promise<NearbyResponse>,
  timeoutMs = 4000,
): Promise<NearbyResponse> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const loaderPromise = loader()
    // timeout이 먼저 끝나더라도 늦게 도착한 로더 실패가 unhandledRejection 되지 않게 흡수
    loaderPromise.catch(() => {})
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('nearby-ssr-timeout')), timeoutMs)
    })
    const result = await Promise.race([loaderPromise, timeout])
    return result ?? emptyNearby()
  } catch {
    return emptyNearby()
  } finally {
    if (timer) clearTimeout(timer)
  }
}
