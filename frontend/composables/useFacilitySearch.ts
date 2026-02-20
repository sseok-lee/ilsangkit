import { ref, readonly } from 'vue'
import type { SearchParams, SearchResponse, GroupedSearchResponse, GroupedCategory, ApiResponse, Facility, FacilityCategory } from '~/types/facility'

export function useFacilitySearch() {
  const loading = ref(false)
  const facilities = ref<Facility[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(0)
  const error = ref<string | null>(null)
  const groupedResults = ref<GroupedCategory[]>([])
  const groupedTotalCount = ref(0)
  const crossFacilities = ref<Facility[]>([])
  const crossLoading = ref(false)

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

  const searchNearby = async (params: {
    lat: number
    lng: number
    category: FacilityCategory
    radius?: number
  }): Promise<{ items: Facility[] }> => {
    const { lat, lng, category, radius = 1000 } = params

    await search({ category, lat, lng, radius, page: 1, limit: 100 })

    return { items: facilities.value }
  }

  const resetPage = () => {
    currentPage.value = 1
  }

  const setPage = (page: number) => {
    currentPage.value = page
  }

  const searchGrouped = async (params: Omit<SearchParams, 'grouped'>) => {
    loading.value = true
    error.value = null

    try {
      let apiBase = 'http://localhost:8000'
      try {
        const config = useRuntimeConfig()
        apiBase = config.public.apiBase
      } catch (e) {
        // In test environment, useRuntimeConfig might not be available
      }

      const response = await $fetch<ApiResponse<GroupedSearchResponse>>(
        `${apiBase}/api/facilities/search`,
        {
          method: 'POST',
          body: { ...params, grouped: true },
        }
      )

      if (response.success && response.data) {
        groupedResults.value = response.data.categories
        groupedTotalCount.value = response.data.totalCount
      }
    } catch (err: any) {
      error.value = err?.message || '검색 중 오류가 발생했습니다'
      groupedResults.value = []
      groupedTotalCount.value = 0
    } finally {
      loading.value = false
    }
  }

  const searchNearbyCross = async (category: string, id: string) => {
    crossLoading.value = true
    try {
      let apiBase = 'http://localhost:8000'
      try {
        const config = useRuntimeConfig()
        apiBase = config.public.apiBase
      } catch (e) {
        // In test environment, useRuntimeConfig might not be available
      }

      const response = await $fetch<ApiResponse<{ items: Facility[] }>>(
        `${apiBase}/api/facilities/${category}/${id}/nearby`
      )

      if (response.success && response.data) {
        crossFacilities.value = response.data.items
      }
    } catch (err: any) {
      crossFacilities.value = []
    } finally {
      crossLoading.value = false
    }
  }

  const clearResults = () => {
    facilities.value = []
    total.value = 0
    currentPage.value = 1
    totalPages.value = 0
    groupedResults.value = []
    groupedTotalCount.value = 0
    crossFacilities.value = []
  }

  return {
    loading: readonly(loading),
    facilities: readonly(facilities),
    total: readonly(total),
    currentPage: readonly(currentPage),
    totalPages: readonly(totalPages),
    error: readonly(error),
    groupedResults: readonly(groupedResults),
    groupedTotalCount: readonly(groupedTotalCount),
    crossFacilities: readonly(crossFacilities),
    crossLoading: readonly(crossLoading),
    search,
    searchGrouped,
    searchNearby,
    searchNearbyCross,
    resetPage,
    setPage,
    clearResults,
  }
}
