import { computed, getCurrentInstance, onUnmounted, readonly, ref } from 'vue'
import type { RisingRegions, RisingScope } from '~/types/housingRedesign'

interface ApiResponse<T> {
  success: boolean
  data: T
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function useRisingRegions() {
  const apiBase = useApiBase()
  const scope = ref<RisingScope>('all')
  const tabData = ref<RisingRegions | null>(null)
  const pending = ref(false)
  const tabError = ref<unknown>(null)
  const cache = new Map<RisingScope, RisingRegions>()
  let activeRequest = 0
  let activeController: AbortController | null = null

  async function fetchScope(target: RisingScope, signal?: AbortSignal): Promise<RisingRegions> {
    const response = await $fetch<ApiResponse<RisingRegions>>(`${apiBase}/api/real-estate/rising-regions`, {
      query: { scope: target },
      signal,
    })
    return response.data
  }

  // SSR 은 전국 탭만 조회한다. 실패는 asyncState.error 로 그대로 드러낸다.
  const asyncState = useAsyncData<RisingRegions | null>(
    'home-rising:all',
    () => fetchScope('all'),
    { default: () => null }
  )

  // 표시 데이터는 asyncState 에서 직접 파생한다(SSR 에서 핸들러 resolve 후에도 반영되도록).
  const data = computed<RisingRegions | null>(() => {
    if (scope.value === 'all') return (asyncState.data.value as RisingRegions | null) ?? tabData.value
    return tabData.value
  })
  const error = computed<unknown>(() => {
    if (tabError.value) return tabError.value
    return scope.value === 'all' ? (asyncState.error.value ?? null) : null
  })

  async function setScope(next: RisingScope): Promise<void> {
    scope.value = next
    activeController?.abort()
    const requestId = ++activeRequest
    tabError.value = null
    const cached = cache.get(next)
    if (cached) {
      tabData.value = cached
      pending.value = false
      return
    }
    if (next === 'all' && asyncState.data.value) {
      pending.value = false
      return
    }

    activeController = new AbortController()
    pending.value = true
    tabData.value = null
    try {
      const result = await fetchScope(next, activeController.signal)
      if (requestId !== activeRequest) return
      cache.set(next, result)
      tabData.value = result
    } catch (err) {
      if (requestId !== activeRequest || isAbortError(err)) return
      tabError.value = err
    } finally {
      if (requestId === activeRequest) pending.value = false
    }
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      activeController?.abort()
    })
  }

  return {
    scope: readonly(scope),
    data,
    pending: readonly(pending),
    error,
    setScope,
  }
}
