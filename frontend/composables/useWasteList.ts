import { computed } from 'vue'
import { useWasteSchedule, type RegionScheduleResponse } from '~/composables/useWasteSchedule'
import type { WasteListQuery } from '~/types/wasteList'
import { wasteListRequestKey } from '~/utils/wasteListQuery'

interface WasteListEnvelope {
  requestKey: string
  result: RegionScheduleResponse | null
}

export function useWasteList(input: { active: () => boolean; query: () => WasteListQuery }) {
  const sources = useWasteSchedule()
  const key = computed(() => input.active() ? wasteListRequestKey(input.query()) : 'waste-list:inactive')
  const state = useAsyncData<WasteListEnvelope>(key, async (_app, { signal }) => {
    const requestKey = key.value
    if (!input.active()) return { requestKey, result: null }
    const query = { ...input.query() }
    return { requestKey, result: await sources.getSchedules(query, signal) }
  }, { dedupe: 'cancel', timeout: 8000 })
  const result = computed(() => state.data.value?.requestKey === key.value ? state.data.value.result : null)

  return { key, state, result }
}
