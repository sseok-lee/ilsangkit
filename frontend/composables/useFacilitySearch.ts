import { ref, readonly } from 'vue'
import type { SearchParams, SearchResponse, ApiResponse, Facility } from '~/types/facility'

export function useFacilitySearch() {
  const loading = ref(false)
  const facilities = ref<Facility[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(0)
  const error = ref<string | null>(null)

  const search = async (params: SearchParams) => {
    loading.value = true
    error.value = null

    try {
      // Get API base URL (with fallback for tests)
      let apiBase = 'http://localhost:8000'
      try {
        const config = useRuntimeConfig()
        apiBase = config.public.apiBase
      } catch (e) {
        // In test environment, useRuntimeConfig might not be available
      }

      const response = await $fetch<ApiResponse<SearchResponse>>(
        `${apiBase}/api/facilities/search`,
        {
          method: 'POST',
          body: params,
        }
      )

      if (response.success && response.data) {
        facilities.value = response.data.items
        total.value = response.data.total
        currentPage.value = response.data.page
        totalPages.value = response.data.totalPages
      }
    } catch (err: any) {
      error.value = err?.message || '검색 중 오류가 발생했습니다'
      facilities.value = []
      total.value = 0
      currentPage.value = 1
      totalPages.value = 0
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    facilities: readonly(facilities),
    total: readonly(total),
    currentPage: readonly(currentPage),
    totalPages: readonly(totalPages),
    error: readonly(error),
    search,
  }
}
