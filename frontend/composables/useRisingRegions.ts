import { getCurrentInstance, onUnmounted, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
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
  const data = ref<RisingRegions | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
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

  // SSR 은 전국 탭만 조회한다. 실패해도 홈 렌더가 깨지지 않도록 null 로 흡수한다.
  const asyncState = useAsyncData<RisingRegions | null>(
    'home-rising:all',
    async () => {
      try {
        return await fetchScope('all')
      } catch {
        return null
      }
    },
    { default: () => null }
  )

  watch(
    asyncState.data as Ref<RisingRegions | null>,
    (next) => {
      if (!next) return
      cache.set('all', next)
      if (scope.value === 'all') data.value = next
    },
    { immediate: true }
  )

  async function setScope(next: RisingScope): Promise<void> {
    scope.value = next
    activeController?.abort()
    const requestId = ++activeRequest
    const cached = cache.get(next)
    if (cached) {
      data.value = cached
      error.value = null
      pending.value = false
      return
    }

    activeController = new AbortController()
    pending.value = true
    error.value = null
    try {
      const result = await fetchScope(next, activeController.signal)
      if (requestId !== activeRequest) return
      cache.set(next, result)
      data.value = result
    } catch (err) {
      if (requestId !== activeRequest || isAbortError(err)) return
      error.value = err
      data.value = null
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
    data: readonly(data),
    pending: readonly(pending),
    error: readonly(error),
    setScope,
  }
}
