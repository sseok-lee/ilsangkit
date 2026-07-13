import { readonly, unref, type Ref } from 'vue'

/**
 * 전국 부동산 단지 수(getComplexList total, VALID_NAME 정합) 공용 컴포저블.
 * S4(지역 RE 목록) '전국 등록' 셀 전용 — '이 지역'(유효 단지)과 동일 단위(VALID_NAME
 * 단지 수)를 맞추기 위해 getStats.realEstateBuildings가 아닌 getComplexList를 사용한다.
 * server:true — SSR/크롤러에게도 노출(신뢰 카운터 밴드, 사용자 결정).
 * fail-open — 실패해도 절대 throw 하지 않고 null을 반환. SSR 렌더/noindex 게이팅에
 * 절대 연결하지 말 것(CRITICAL) — 실패는 셀 부재로만 이어져야 한다.
 */
export function useNationalComplexCount(apiSlug: string | Ref<string>) {
  const apiBase = useApiBase()
  const slug = unref(apiSlug)
  const { data } = useAsyncData<number | null>(
    `national-complex-${slug}`,
    async () => {
      try {
        // S3(pages/real-estate/[realEstateType]/index.vue)의 기존 SSR getComplexList
        // 호출과 동일 엔드포인트(`/api/real-estate/${type}/complexes`)를 city/district
        // 없이, limit=1로 호출해 전국 total만 취한다.
        const res = await $fetch<{ success: boolean; data: { total: number } }>(
          `${apiBase}/api/real-estate/${slug}/complexes`,
          { query: { page: 1, limit: 1 }, signal: AbortSignal.timeout(8000) },
        )
        return res?.data?.total ?? null
      } catch {
        return null // fail-open: 실패=null, 절대 throw 안 함(SSR 렌더/noindex 미게이팅)
      }
    },
    { server: true },
  )

  return { total: readonly(data) }
}
