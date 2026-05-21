import type { SubwayStation } from '~/types/subway'

interface ApiResponse<T> {
  success: boolean
  data: T
}

export function useSubwayStation(slug: string) {
  const apiBase = useApiBase()

  return useAsyncData(
    `subway-station-${slug}`,
    () => $fetch<ApiResponse<SubwayStation>>(`${apiBase}/api/subway/stations/${slug}`),
  )
}
