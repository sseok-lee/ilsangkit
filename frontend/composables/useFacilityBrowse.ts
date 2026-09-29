import { useApiBase } from '~/composables/useApiBase'
import type { BrowseFilters, BrowseResult } from '~/types/facilityBrowse'
import { normalizeFacilityBrowseQuery } from '~/utils/facilityBrowseQuery'

export function useFacilityBrowse() {
  const apiBase = useApiBase()

  async function fetchBrowse(filters: BrowseFilters, signal?: AbortSignal): Promise<BrowseResult> {
    const normalized = normalizeFacilityBrowseQuery({ ...filters, departments: filters.departments.join(',') })
    if (!normalized.city || !normalized.district) throw new Error('시·도와 구·군 지역을 선택해 주세요.')
    const response = await $fetch<{ success: boolean; data?: BrowseResult | null }>(`${apiBase}/api/facilities/browse`, {
      signal,
      query: {
        city: normalized.city,
        district: normalized.district,
        category: normalized.category || undefined,
        keyword: normalized.q || undefined,
        page: normalized.page,
        limit: 20,
        departments: normalized.departments.join(',') || undefined,
      },
    })
    if (!response.success || !response.data) throw new Error('생활시설 정보를 불러오지 못했습니다.')
    return response.data
  }

  return { fetchBrowse }
}
