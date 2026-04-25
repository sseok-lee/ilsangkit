import { ref, readonly } from 'vue'
import type {
  LhAnnouncement,
  LhAnnouncementListQuery,
  LhAnnouncementListResponse,
} from '~/types/lhAnnouncement'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export function useLhAnnouncement() {
  const items = ref<LhAnnouncement[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(1)
  const detail = ref<LhAnnouncement | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const apiBase = (): string => useApiBase()

  const fetchList = async (params: LhAnnouncementListQuery = {}): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<LhAnnouncementListResponse>>(
        `${apiBase()}/api/lh-announcement`,
        { query: params },
      )
      if (res.success && res.data) {
        items.value = res.data.items
        total.value = res.data.pagination.total
        totalPages.value = res.data.pagination.totalPages
        currentPage.value = res.data.pagination.page
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'LH 공고 목록 조회에 실패했습니다.'
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
      const res = await $fetch<ApiEnvelope<LhAnnouncement>>(
        `${apiBase()}/api/lh-announcement/${id}`,
      )
      if (res.success && res.data) {
        detail.value = res.data
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'LH 공고 상세 조회에 실패했습니다.'
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    items: readonly(items),
    total: readonly(total),
    totalPages: readonly(totalPages),
    currentPage: readonly(currentPage),
    detail: readonly(detail),
    loading: readonly(loading),
    error: readonly(error),
    fetchList,
    fetchDetail,
  }
}
