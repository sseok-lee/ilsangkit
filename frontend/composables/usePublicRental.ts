import { ref, readonly } from 'vue'
import type {
  PublicRentalComplex,
  PublicRentalListQuery,
  PublicRentalListResponse,
  PublicRentalStat,
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
  const stats = ref<PublicRentalStat[]>([])
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

  const fetchDetail = async (id: number): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalComplex>>(
        `${apiBase()}/api/public-rental/${id}`,
      )
      if (res.success && res.data) {
        detail.value = res.data
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '공공임대 상세 조회에 실패했습니다.'
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  const fetchStats = async (): Promise<void> => {
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalStat[]>>(
        `${apiBase()}/api/public-rental/stats`,
      )
      if (res.success && res.data) stats.value = res.data
    } catch {
      stats.value = []
    }
  }

  return {
    items: readonly(items),
    total: readonly(total),
    totalPages: readonly(totalPages),
    currentPage: readonly(currentPage),
    detail: readonly(detail),
    stats: readonly(stats),
    loading: readonly(loading),
    error: readonly(error),
    fetchList,
    fetchDetail,
    fetchStats,
  }
}
