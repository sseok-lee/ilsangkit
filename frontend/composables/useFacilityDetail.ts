import { ref, readonly } from 'vue'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

export function useFacilityDetail() {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const facility = ref<FacilityDetail | null>(null)

  async function fetchDetail(
    category: FacilityCategory,
    id: string
  ): Promise<FacilityDetail | null> {
    loading.value = true
    error.value = null
    facility.value = null

    try {
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase

      const data = await $fetch<FacilityDetail>(
        `${apiBase}/api/facilities/${category}/${id}`
      )

      facility.value = data
      return data
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    facility: readonly(facility),
    fetchDetail,
  }
}
