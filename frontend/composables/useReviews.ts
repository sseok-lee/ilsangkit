import { ref, readonly } from 'vue'
import type {
  Review,
  ReviewWithFacility,
  CreateReviewPayload,
  UpdateReviewPayload,
  ReviewListResponse,
} from '~/types/review'

export function useReviews() {
  const reviews = ref<Review[]>([])
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchReviews(
    category: string,
    facilityId: string,
    pageNum = 1,
    limit = 10
  ) {
    loading.value = true
    error.value = null

    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ success: boolean; data: ReviewListResponse }>(
        `${config.public.apiBase}/api/reviews/facility/${category}/${facilityId}`,
        { query: { page: pageNum, limit } }
      )

      if (pageNum === 1) {
        reviews.value = response.data.items
      } else {
        reviews.value = [...reviews.value, ...response.data.items]
      }
      total.value = response.data.total
      page.value = response.data.page
      totalPages.value = response.data.totalPages
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }

  async function createReview(payload: CreateReviewPayload): Promise<Review | null> {
    loading.value = true
    error.value = null

    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ success: boolean; data: Review }>(
        `${config.public.apiBase}/api/reviews`,
        { method: 'POST', body: payload }
      )

      // 새 리뷰를 목록 맨 앞에 추가
      reviews.value = [response.data, ...reviews.value]
      total.value += 1
      return response.data
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateReview(id: number, payload: UpdateReviewPayload): Promise<Review | null> {
    error.value = null

    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ success: boolean; data: Review }>(
        `${config.public.apiBase}/api/reviews/${id}`,
        { method: 'PUT', body: payload }
      )

      // 목록에서 해당 리뷰 업데이트
      const index = reviews.value.findIndex(r => r.id === id)
      if (index !== -1) {
        reviews.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err as Error
      return null
    }
  }

  async function deleteReview(id: number, password: string): Promise<boolean> {
    error.value = null

    try {
      const config = useRuntimeConfig()
      await $fetch(
        `${config.public.apiBase}/api/reviews/${id}`,
        { method: 'DELETE', body: { password } }
      )

      // 목록에서 제거
      reviews.value = reviews.value.filter(r => r.id !== id)
      total.value -= 1
      return true
    } catch (err) {
      error.value = err as Error
      return false
    }
  }

  return {
    reviews: readonly(reviews),
    total: readonly(total),
    page: readonly(page),
    totalPages: readonly(totalPages),
    loading: readonly(loading),
    error: readonly(error),
    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  }
}

export function useRecentReviews() {
  const recentReviews = ref<ReviewWithFacility[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchRecentReviews(limit = 6) {
    loading.value = true
    error.value = null

    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ success: boolean; data: ReviewWithFacility[] }>(
        `${config.public.apiBase}/api/reviews/recent`,
        { query: { limit } }
      )

      recentReviews.value = response.data
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }

  return {
    recentReviews: readonly(recentReviews),
    loading: readonly(loading),
    error: readonly(error),
    fetchRecentReviews,
  }
}
