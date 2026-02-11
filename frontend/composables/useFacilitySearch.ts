import { ref, readonly } from 'vue'
import type { SearchParams, SearchResponse, ApiResponse, Facility } from '~/types/facility'

/**
 * Haversine 공식을 사용한 두 지점 간 거리 계산 (미터 단위)
 * 클라이언트 사이드에서 거리 계산 수행 (서버로 GPS 좌표 미전송)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 시설 목록에 거리를 계산하여 추가하고, 거리순 정렬
 */
function addDistanceAndSort(
  items: Facility[],
  userLat: number,
  userLng: number
): Facility[] {
  return items
    .map((item) => ({
      ...item,
      distance: Math.round(calculateDistance(userLat, userLng, item.lat, item.lng)),
    }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
}

/**
 * 지도 영역(bounds) 내 시설만 필터링
 */
function filterByBounds(
  items: Facility[],
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number }
): Facility[] {
  return items.filter(
    (item) => item.lat >= sw.lat && item.lat <= ne.lat && item.lng >= sw.lng && item.lng <= ne.lng
  )
}

export function useFacilitySearch() {
  const loading = ref(false)
  const facilities = ref<Facility[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(0)
  const error = ref<string | null>(null)

  const search = async (
    params: SearchParams,
    options?: {
      userLocation?: { lat: number; lng: number } | null
      mapBounds?: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null
    }
  ) => {
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
        let items = response.data.items

        // 클라이언트 사이드: 지도 영역 필터링
        if (options?.mapBounds) {
          items = filterByBounds(items, options.mapBounds.sw, options.mapBounds.ne)
        }

        // 클라이언트 사이드: 거리 계산 + 정렬
        if (options?.userLocation) {
          items = addDistanceAndSort(items, options.userLocation.lat, options.userLocation.lng)
        }

        facilities.value = items
        total.value = options?.mapBounds || options?.userLocation ? items.length : response.data.total
        currentPage.value = response.data.page
        totalPages.value = options?.mapBounds || options?.userLocation
          ? Math.ceil(items.length / (params.limit ?? 20))
          : response.data.totalPages
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
    category: string
    radius?: number
  }): Promise<{ items: Facility[] }> => {
    const { lat, lng, category, radius = 1000 } = params

    // 서버에는 카테고리만 전송, GPS 좌표는 전송하지 않음
    await search(
      { category, page: 1, limit: 100 },
      { userLocation: { lat, lng } }
    )

    // 반경 내 시설만 필터링
    const filtered = facilities.value.filter((f) => (f.distance ?? Infinity) <= radius)
    facilities.value = filtered

    return { items: facilities.value }
  }

  const resetPage = () => {
    currentPage.value = 1
  }

  const setPage = (page: number) => {
    currentPage.value = page
  }

  const clearResults = () => {
    facilities.value = []
    total.value = 0
    currentPage.value = 1
    totalPages.value = 0
  }

  return {
    loading: readonly(loading),
    facilities: readonly(facilities),
    total: readonly(total),
    currentPage: readonly(currentPage),
    totalPages: readonly(totalPages),
    error: readonly(error),
    search,
    searchNearby,
    resetPage,
    setPage,
    clearResults,
  }
}
