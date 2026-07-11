import { computed, readonly } from 'vue'

/**
 * 카테고리별 최근 동기화 시각 (/api/meta/sync-status) 공용 컴포저블.
 * stable key 하나로 페이지당 1회만 fetch (Nuxt useAsyncData 키 dedupe).
 * SSR 미실행(server:false) — SSR/hydration은 null(라벨만) → 클라이언트에서 반응형 갱신.
 */
export function useSyncStatus() {
  const apiBase = useApiBase()
  const { data } = useAsyncData<Record<string, string | null> | null>(
    'sync-status',
    async () => {
      const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal: AbortSignal.timeout(8000) },
      )
      return res.data ?? null
    },
    { server: false },
  )

  /** 전 카테고리 통틀어 가장 최근 동기화 ISO (사전순=시간순, null 무시) */
  const latestOverall = computed<string | null>(() => {
    const s = data.value
    if (!s) return null
    const dates = Object.values(s).filter((v): v is string => !!v)
    return dates.length ? [...dates].sort().at(-1) ?? null : null
  })

  return { syncStatus: readonly(data), latestOverall }
}
