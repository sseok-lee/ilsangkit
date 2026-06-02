import { ref, readonly } from 'vue'
import type {
  PublicRentalComplex,
  PublicRentalListQuery,
  PublicRentalListResponse,
} from '~/types/publicRental'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export function usePublicRental() {
  const items = ref<PublicRentalComplex[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(1)
  const detail = ref<PublicRentalComplex | null>(null)
  const siblings = ref<PublicRentalComplex[]>([])
  const nearby = ref<PublicRentalComplex[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const apiBase = (): string => useApiBase()

  const fetchList = async (params: PublicRentalListQuery = {}): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalListResponse>>(
        `${apiBase()}/api/public-rental`,
        { query: params },
      )
      if (res.success && res.data) {
        items.value = res.data.items
        total.value = res.data.pagination.total
        totalPages.value = res.data.pagination.totalPages
        currentPage.value = res.data.pagination.page
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '공공임대 목록 조회에 실패했습니다.'
      items.value = []
      total.value = 0
      totalPages.value = 0
    } finally {
      loading.value = false
    }
  }

  const getList = async (params: PublicRentalListQuery = {}): Promise<PublicRentalListResponse> => {
    const res = await $fetch<ApiEnvelope<PublicRentalListResponse>>(
      `${apiBase()}/api/public-rental`,
      { query: params },
    )
    if (res.success && res.data) return res.data
    throw new Error('공공임대 목록 조회에 실패했습니다.')
  }

  const fetchDetail = async (id: number): Promise<PublicRentalComplex | null> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalComplex>>(
        `${apiBase()}/api/public-rental/${id}`,
      )
      if (res.success && res.data) {
        detail.value = res.data
        return res.data
      }
      detail.value = null
      return null
    } catch (err) {
      error.value = err instanceof Error ? err.message : '공공임대 상세 조회에 실패했습니다.'
      detail.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchSiblings = async (id: number): Promise<PublicRentalComplex[]> => {
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalComplex[]>>(
        `${apiBase()}/api/public-rental/${id}/siblings`,
      )
      if (res.success && res.data) {
        siblings.value = res.data
        return res.data
      }
      siblings.value = []
      return []
    } catch {
      siblings.value = []
      return []
    }
  }

  const fetchNearby = async (id: number): Promise<PublicRentalComplex[]> => {
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalComplex[]>>(
        `${apiBase()}/api/public-rental/${id}/nearby`,
      )
      if (res.success && res.data) {
        nearby.value = res.data
        return res.data
      }
      nearby.value = []
      return []
    } catch {
      nearby.value = []
      return []
    }
  }

  return {
    items: readonly(items),
    total: readonly(total),
    totalPages: readonly(totalPages),
    currentPage: readonly(currentPage),
    detail: readonly(detail),
    siblings: readonly(siblings),
    nearby: readonly(nearby),
    loading: readonly(loading),
    error: readonly(error),
    fetchList,
    getList,
    fetchDetail,
    fetchSiblings,
    fetchNearby,
  }
}
