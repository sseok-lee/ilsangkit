import type { AreaDetail, AreaList, AreaQuery } from '~/types/wasteArea'

interface ApiResponse<T> {
  success: boolean
  data: T
}

export function useWasteAreas() {
  const apiBase = useApiBase()

  async function list(query: AreaQuery, signal?: AbortSignal): Promise<AreaList> {
    const response = await $fetch<ApiResponse<AreaList>>(`${apiBase}/api/waste-areas`, {
      query: {
        city: query.city,
        district: query.district,
        keyword: query.keyword,
        page: query.page,
        limit: query.limit,
      },
      signal,
    })
    if (!response?.success || !response.data) throw new Error('동별 쓰레기 배출 안내를 불러오지 못했습니다')
    return response.data
  }

  async function detail(id: number, signal?: AbortSignal): Promise<AreaDetail> {
    const response = await $fetch<ApiResponse<AreaDetail>>(`${apiBase}/api/waste-areas/${id}`, { signal })
    if (!response?.success || !response.data) throw new Error('동별 쓰레기 배출 상세를 불러오지 못했습니다')
    return response.data
  }

  return { list, detail }
}
