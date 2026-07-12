import { readonly } from 'vue'

/**
 * 전국 시설 카운트 (/api/meta/stats) 공용 컴포저블.
 * server:true — SSR에서도 fetch (신뢰 카운터 밴드가 크롤러에게도 보여야 함, 사용자 결정).
 * fail-open — 실패해도 절대 throw 하지 않고 null을 반환. SSR 렌더/noindex 게이팅에 영향 없음.
 */
export interface StatsData {
  total?: number
  [key: string]: number | Record<string, number> | undefined
}

export function useNationalStats() {
  const apiBase = useApiBase()
  const { data } = useAsyncData<StatsData | null>(
    'national-stats',
    async () => {
      try {
        const res = await $fetch<{ success: boolean; data: StatsData }>(`${apiBase}/api/meta/stats`, {
          signal: AbortSignal.timeout(8000),
        })
        return res.data ?? null
      } catch {
        return null // fail-open: 실패=null, 절대 throw 안 함(SSR 렌더/noindex 미게이팅)
      }
    },
    { server: true },
  )

  return { stats: readonly(data) }
}
