import { computed, onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue'
import type { NearbyResponse, TransactionMode } from '~/types/realEstate'

interface NearbyQuery {
  bjdCode: string
  mode: TransactionMode
  rentType?: string
  dongName?: string
  excludeBuildingName: string
  limitPerType: number
}

type FetchNearby = ReturnType<typeof useRealEstate>['getNearby']
const emptyNearby = (): NearbyResponse => ({ apt: [], villa: [], offitel: [] })

/** A failed refresh may retain data only for the exact query that produced it. */
export function useNearbyComplexes(
  query: Ref<NearbyQuery>,
  fetchNearby: FetchNearby,
  initial?: NearbyResponse,
) {
  const normalized = computed(() => ({
    ...query.value,
    rentType: query.value.mode === 'rent'
      ? query.value.rentType === 'jeonse' ? 'jeonse' as const
        : query.value.rentType === 'wolse' ? 'wolse' as const : 'all' as const
      : undefined,
  }))
  const key = computed(() => JSON.stringify(normalized.value))
  const nearby = shallowRef(initial ?? emptyNearby())
  let dataKey = key.value
  let requestId = 0

  async function refresh() {
    if (import.meta.server) return
    const requestedKey = key.value
    const id = ++requestId
    const { bjdCode, mode, ...options } = normalized.value
    if (dataKey !== requestedKey || !bjdCode) {
      nearby.value = emptyNearby()
      dataKey = requestedKey
    }
    if (!bjdCode) return
    try {
      const result = await fetchNearby(bjdCode, mode, options)
      if (id === requestId && requestedKey === key.value) nearby.value = result
    } catch {
      // Preserve this query's SSR/successful result, including a genuine empty list.
    }
  }

  watch(key, () => { void refresh() }, { flush: 'sync' })
  onScopeDispose(() => { requestId++ })
  if (!initial) void refresh()

  return { nearby: readonly(nearby), refresh }
}
