import { computed, getCurrentInstance, onUnmounted, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { HomeMarket } from '~/types/housingRedesign'
import { normalizeMarketRegion, type NormalizedMarketRegion } from '~/utils/homeMarketRegion'

interface ApiResponse<T> {
  success: boolean
  data: T
}

const COOKIE_NAME = 'ilsangkit-market-region-v1'

function buildQuery(region: NormalizedMarketRegion): Record<string, string> {
  const query: Record<string, string> = {}
  if (region.city) query.city = region.city
  if (region.district) query.district = region.district
  return query
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function useHomeMarket() {
  const apiBase = useApiBase()
  const saved = useCookie<NormalizedMarketRegion | null>(COOKIE_NAME, {
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax',
  })
  const region = ref(normalizeMarketRegion(saved.value))
  const data = ref<HomeMarket | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)
  const requestKey = computed(() => `home-market:${region.value.city ?? 'all'}:${region.value.district ?? 'all'}`)
  let activeRequest = 0
  let activeController: AbortController | null = null

  async function load(signal?: AbortSignal): Promise<HomeMarket | null> {
    const requestId = ++activeRequest
    pending.value = true
    error.value = null
    data.value = null

    try {
      const response = await $fetch<ApiResponse<HomeMarket>>(`${apiBase}/api/real-estate/home-market`, {
        query: buildQuery(region.value),
        signal,
      })
      if (requestId === activeRequest) {
        data.value = response.data
      }
      return response.data
    } catch (err) {
      if (requestId === activeRequest && !isAbortError(err)) {
        error.value = err
        data.value = null
      }
      return null
    } finally {
      if (requestId === activeRequest) {
        pending.value = false
      }
    }
  }

  const asyncState = useAsyncData<HomeMarket | null>(
    requestKey,
    () => load(),
    { default: () => null }
  )

  watch(
    asyncState.data as Ref<HomeMarket | null>,
    (next) => {
      if (next) data.value = next
    },
    { immediate: true }
  )

  async function setRegion(city: string | null, district: string | null): Promise<void> {
    const next = normalizeMarketRegion({ city, district })
    region.value = next
    try {
      saved.value = next.city ? next : null
    } catch {
      // Browsers can reject cookie writes in private or blocked-cookie contexts.
    }

    activeController?.abort()
    activeController = new AbortController()
    await load(activeController.signal)
  }

  async function refresh(): Promise<void> {
    activeController?.abort()
    activeController = new AbortController()
    await load(activeController.signal)
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      activeController?.abort()
    })
  }

  return {
    region: readonly(region),
    data: readonly(data),
    pending: readonly(pending),
    error: readonly(error),
    setRegion,
    refresh,
  }
}
