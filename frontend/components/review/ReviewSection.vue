<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
      <span class="material-symbols-outlined text-primary text-[20px]">rate_review</span>
      <h2 class="text-slate-900 text-lg font-bold">리뷰 ({{ total }})</h2>
    </div>

    <div class="p-5 flex flex-col gap-5">
      <!-- Write Review Form -->
      <form class="flex flex-col gap-3" @submit.prevent="handleSubmit">
        <div class="flex gap-3">
          <input
            v-model="form.nickname"
            type="text"
            placeholder="닉네임"
            maxlength="30"
            class="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <input
            v-model="form.password"
            type="password"
            placeholder="비밀번호 (4~20자)"
            maxlength="20"
            class="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="relative">
          <textarea
            v-model="form.content"
            placeholder="리뷰를 작성해주세요..."
            maxlength="1000"
            rows="3"
            class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
          <span class="absolute bottom-2 right-3 text-xs text-slate-500">{{ form.content.length }}/1000</span>
        </div>
        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="submitting || !isFormValid"
            class="px-5 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? '작성 중...' : '리뷰 작성' }}
          </button>
        </div>
        <p v-if="formError" class="text-red-500 text-xs">{{ formError }}</p>
      </form>

      <!-- Divider -->
      <div v-if="reviews.length > 0" class="h-px bg-slate-100"></div>

      <!-- Review List -->
      <div v-if="loading && reviews.length === 0" class="flex justify-center py-6">
        <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>

      <div v-else-if="reviews.length === 0 && !loading" class="text-center py-6">
        <span class="material-symbols-outlined text-[40px] text-slate-500 mb-2">chat_bubble_outline</span>
        <p class="text-sm text-slate-500">아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div
          v-for="review in reviews"
          :key="review.id"
          class="flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-slate-900">{{ review.nickname }}</span>
              <ClientOnly>
                <span class="text-xs text-slate-500">{{ formatDate(review.createdAt) }}</span>
                <template #fallback>
                  <span class="text-xs text-slate-500">{{ formatDateStatic(review.createdAt) }}</span>
                </template>
              </ClientOnly>
              <span v-if="review.updatedAt !== review.createdAt" class="text-xs text-slate-500">(수정됨)</span>
            </div>
            <div class="flex gap-1">
              <button
                :aria-label="`${review.nickname}님의 리뷰 수정`"
                class="text-xs text-slate-500 hover:text-primary transition-colors min-h-11 min-w-11 px-3 py-2"
                @click="openEditModal(review)"
              >
                수정
              </button>
              <button
                :aria-label="`${review.nickname}님의 리뷰 삭제`"
                class="text-xs text-slate-500 hover:text-red-500 transition-colors min-h-11 min-w-11 px-3 py-2"
                @click="openDeleteModal(review.id)"
              >
                삭제
              </button>
            </div>
          </div>
          <p class="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{{ review.content }}</p>
          <div v-if="review !== reviews[reviews.length - 1]" class="h-px bg-slate-100 mt-2"></div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="page < totalPages" class="flex justify-center">
        <button
          :disabled="loading"
          class="px-5 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
          @click="loadMore"
        >
          {{ loading ? '로딩 중...' : '더보기' }}
        </button>
      </div>
    </div>

    <!-- Password Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="modalState.show"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          @click.self="closeModal"
        >
          <div ref="modalRef" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6" @keydown="handleModalKeydown">
            <h3 id="review-modal-title" class="text-lg font-bold text-slate-900 mb-4">
              {{ modalState.type === 'edit' ? '리뷰 수정' : '리뷰 삭제' }}
            </h3>

            <!-- Edit form -->
            <template v-if="modalState.type === 'edit'">
              <div class="flex flex-col gap-3 mb-4">
                <input
                  v-model="modalState.nickname"
                  type="text"
                  placeholder="닉네임 (변경시 입력)"
                  maxlength="30"
                  class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <textarea
                  v-model="modalState.content"
                  placeholder="수정할 내용"
                  maxlength="1000"
                  rows="4"
                  class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
                <input
                  v-model="modalState.password"
                  type="password"
                  placeholder="비밀번호 확인"
                  class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </template>

            <!-- Delete confirmation -->
            <template v-else>
              <p class="text-sm text-slate-600 mb-4">삭제하려면 비밀번호를 입력해주세요.</p>
              <input
                v-model="modalState.password"
                type="password"
                placeholder="비밀번호"
                class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4"
                @keydown.enter="handleModalConfirm"
              />
            </template>

            <p v-if="modalState.error" class="text-red-500 text-xs mb-3">{{ modalState.error }}</p>

            <div class="flex gap-3 justify-end">
              <button
                class="px-4 py-2 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                @click="closeModal"
              >
                취소
              </button>
              <button
                :disabled="modalState.processing || !modalState.password"
                class="px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :class="modalState.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'"
                @click="handleModalConfirm"
              >
                {{ modalState.processing ? '처리 중...' : (modalState.type === 'edit' ? '수정' : '삭제') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, nextTick, onUnmounted } from 'vue'
import type { Review } from '~/types/review'
import { useReviews } from '~/composables/useReviews'
import { useAnalytics } from '~/composables/useAnalytics'

const props = defineProps<{
  category: string
  facilityId: string
}>()

const { trackReviewSubmit } = useAnalytics()

const {
  reviews,
  total,
  page,
  totalPages,
  loading,
  error,
  fetchReviews,
  createReview,
  updateReview,
  deleteReview,
} = useReviews()

const modalRef = ref<HTMLElement | null>(null)

// Modal state
const modalState = reactive({
  show: false,
  type: 'edit' as 'edit' | 'delete',
  reviewId: 0,
  nickname: '',
  content: '',
  password: '',
  error: '',
  processing: false,
})

// Focus trap for modal
watch(() => modalState.show, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    await nextTick()
    const firstFocusable = modalRef.value?.querySelector<HTMLElement>('input, textarea, button')
    firstFocusable?.focus()
  }
})

function handleModalTab(event: KeyboardEvent) {
  if (!modalRef.value) return
  const focusables = modalRef.value.querySelectorAll<HTMLElement>('input, textarea, button, [tabindex]:not([tabindex="-1"])')
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleModalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeModal()
  } else if (event.key === 'Tab') {
    handleModalTab(event)
  }
}

// Form state
const form = reactive({
  nickname: '',
  password: '',
  content: '',
})
const submitting = ref(false)
const formError = ref('')

const isFormValid = computed(() =>
  form.nickname.length > 0 &&
  form.password.length >= 4 &&
  form.content.length > 0
)

onMounted(() => {
  fetchReviews(props.category, props.facilityId)
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatDateStatic(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

async function handleSubmit() {
  if (!isFormValid.value || submitting.value) return

  submitting.value = true
  formError.value = ''

  const result = await createReview({
    facilityCategory: props.category,
    facilityId: props.facilityId,
    nickname: form.nickname,
    password: form.password,
    content: form.content,
  })

  submitting.value = false

  if (result) {
    trackReviewSubmit({ facilityId: props.facilityId, category: props.category })
    form.content = ''
    form.password = ''
  } else {
    formError.value = error.value?.message || '리뷰 작성에 실패했습니다. 다시 시도해주세요.'
  }
}

function loadMore() {
  fetchReviews(props.category, props.facilityId, page.value + 1)
}

function openEditModal(review: Review) {
  modalState.show = true
  modalState.type = 'edit'
  modalState.reviewId = review.id
  modalState.nickname = review.nickname
  modalState.content = review.content
  modalState.password = ''
  modalState.error = ''
  modalState.processing = false
}

function openDeleteModal(reviewId: number) {
  modalState.show = true
  modalState.type = 'delete'
  modalState.reviewId = reviewId
  modalState.nickname = ''
  modalState.content = ''
  modalState.password = ''
  modalState.error = ''
  modalState.processing = false
}

function closeModal() {
  modalState.show = false
}

async function handleModalConfirm() {
  if (!modalState.password || modalState.processing) return

  modalState.processing = true
  modalState.error = ''

  if (modalState.type === 'edit') {
    const result = await updateReview(modalState.reviewId, {
      password: modalState.password,
      content: modalState.content || undefined,
      nickname: modalState.nickname || undefined,
    })

    if (result) {
      closeModal()
    } else {
      modalState.error = '비밀번호가 일치하지 않거나 수정에 실패했습니다.'
    }
  } else {
    const success = await deleteReview(modalState.reviewId, modalState.password)

    if (success) {
      closeModal()
    } else {
      modalState.error = '비밀번호가 일치하지 않거나 삭제에 실패했습니다.'
    }
  }

  modalState.processing = false
}
</script>
