import { ref, readonly } from 'vue'
import type {
  PublicRentalAnnouncement,
  PublicRentalAnnouncementDetail,
  PublicRentalAnnouncementListQuery,
  PublicRentalAnnouncementListResponse,
} from '~/types/publicRentalAnnouncement'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export function useRentalAnnouncements() {
  const items = ref<PublicRentalAnnouncement[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(1)
  const detail = ref<PublicRentalAnnouncementDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const apiBase = (): string => useApiBase()

  const fetchList = async (
    params: PublicRentalAnnouncementListQuery = {},
  ): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalAnnouncementListResponse>>(
        `${apiBase()}/api/public-rental/announcements`,
        { query: params },
      )
      if (res.success && res.data) {
        items.value = res.data.items
        total.value = res.data.pagination.total
        totalPages.value = res.data.pagination.totalPages
        currentPage.value = res.data.pagination.page
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '모집공고 목록 조회에 실패했습니다.'
      items.value = []
      total.value = 0
      totalPages.value = 0
    } finally {
      loading.value = false
    }
  }

  const fetchDetail = async (
    pblancId: string,
  ): Promise<PublicRentalAnnouncementDetail | null> => {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiEnvelope<PublicRentalAnnouncementDetail>>(
        `${apiBase()}/api/public-rental/announcements/${encodeURIComponent(pblancId)}`,
      )
      if (res.success && res.data) {
        detail.value = res.data
        return res.data
      }
      detail.value = null
      return null
    } catch (err) {
      error.value = err instanceof Error ? err.message : '모집공고 상세 조회에 실패했습니다.'
      detail.value = null
      return null
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
