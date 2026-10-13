import { computed } from 'vue'
import { useWasteAreas } from '~/composables/useWasteAreas'
import type { AreaSummary } from '~/types/wasteArea'

interface WasteAreaOptionsResult {
  generationId: string
  items: AreaSummary[]
}

interface WasteAreaOptionsEnvelope {
  requestKey: string
  result: WasteAreaOptionsResult | null
}

const GENERATION_CHANGED = 'WASTE_OPTIONS_GENERATION_CHANGED'

async function loadOptionsPageSet(
  list: ReturnType<typeof useWasteAreas>['list'],
  city: string,
  district: string,
  signal: AbortSignal
): Promise<WasteAreaOptionsResult> {
  const first = await list({ city, district, page: 1, limit: 100 }, signal)
  const items = [...first.items]

  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await list({ city, district, page, limit: 100 }, signal)
    if (next.generationId !== first.generationId) throw new Error(GENERATION_CHANGED)
    items.push(...next.items)
  }

  return {
    generationId: first.generationId,
    items: [...new Map(items.map(area => [area.areaId, area])).values()],
  }
}

async function loadOptionsWithRetry(
  list: ReturnType<typeof useWasteAreas>['list'],
  city: string,
  district: string,
  signal: AbortSignal
): Promise<WasteAreaOptionsResult> {
  try {
    return await loadOptionsPageSet(list, city, district, signal)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== GENERATION_CHANGED) throw error
    return await loadOptionsPageSet(list, city, district, signal)
  }
}

export function useWasteAreaOptions(input: { city: () => string | undefined; district: () => string | undefined; enabled: () => boolean }) {
  const areas = useWasteAreas()
  const key = computed(() => {
    const city = input.city()
    const district = input.district()
    return input.enabled() && city && district ? `waste-area-options:${city}:${district}` : 'waste-area-options:inactive'
  })
  const state = useAsyncData<WasteAreaOptionsEnvelope>(key, async (_app, { signal }) => {
    const requestKey = key.value
    const city = input.city()
    const district = input.district()
    if (!input.enabled() || !city || !district) return { requestKey, result: null }
    return { requestKey, result: await loadOptionsWithRetry(areas.list, city, district, signal) }
  }, { dedupe: 'cancel', timeout: 8000 })
  const result = computed(() => state.data.value?.requestKey === key.value ? state.data.value.result : null)

  return { key, state, result }
}
