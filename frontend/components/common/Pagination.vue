<template>
  <div v-if="totalPages > 1" class="flex justify-center items-center gap-1 py-6">
    <!-- First page -->
    <button
      v-if="!hrefFor || isAtStart"
      :disabled="isAtStart"
      class="pagination-btn"
      aria-label="첫 페이지"
      @click="emit('pageChange', 1)"
    >
      <span class="material-symbols-outlined text-[18px]">first_page</span>
    </button>
    <a
      v-else
      :href="hrefFor(1)"
      class="pagination-btn"
      aria-label="첫 페이지"
      @click="onNavigate($event, 1)"
    >
      <span class="material-symbols-outlined text-[18px]">first_page</span>
    </a>

    <!-- Previous -->
    <button
      v-if="!hrefFor || isAtStart"
      :disabled="isAtStart"
      class="pagination-btn"
      aria-label="이전 페이지"
      @click="emit('pageChange', currentPage - 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_left</span>
    </button>
    <a
      v-else
      :href="hrefFor(currentPage - 1)"
      class="pagination-btn"
      aria-label="이전 페이지"
      @click="onNavigate($event, currentPage - 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_left</span>
    </a>

    <!-- Page numbers -->
    <template v-for="page in visiblePages" :key="page">
      <span v-if="page === '...'" class="px-1 text-slate-500 text-sm">...</span>
      <button
        v-else-if="!hrefFor"
        :class="pageClass(page as number)"
        :aria-label="`${page} 페이지`"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="emit('pageChange', page as number)"
      >
        {{ page }}
      </button>
      <a
        v-else
        :href="hrefFor(page as number)"
        :class="pageClass(page as number)"
        :aria-label="`${page} 페이지`"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="onNavigate($event, page as number)"
      >
        {{ page }}
      </a>
    </template>

    <!-- Next -->
    <button
      v-if="!hrefFor || isAtEnd"
      :disabled="isAtEnd"
      class="pagination-btn"
      aria-label="다음 페이지"
      @click="emit('pageChange', currentPage + 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_right</span>
    </button>
    <a
      v-else
      :href="hrefFor(currentPage + 1)"
      class="pagination-btn"
      aria-label="다음 페이지"
      @click="onNavigate($event, currentPage + 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_right</span>
    </a>

    <!-- Last page -->
    <button
      v-if="!hrefFor || isAtEnd"
      :disabled="isAtEnd"
      class="pagination-btn"
      aria-label="마지막 페이지"
      @click="emit('pageChange', totalPages)"
    >
      <span class="material-symbols-outlined text-[18px]">last_page</span>
    </button>
    <a
      v-else
      :href="hrefFor(totalPages)"
      class="pagination-btn"
      aria-label="마지막 페이지"
      @click="onNavigate($event, totalPages)"
    >
      <span class="material-symbols-outlined text-[18px]">last_page</span>
    </a>
  </div>
</template>

<script setup lang="ts">
// computed 는 명시적으로 import 한다. Nuxt auto-import 에 기대면 vitest 직접 mount 시
// ReferenceError 가 난다(프로덕션 빌드에서는 통과해 CI 에서만 터지는 유형).
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  /**
   * 페이지 번호 → URL 변환기. 주면 페이지네이션이 <button> 대신 <a href> 로 렌더된다.
   *
   * 크롤러는 click 핸들러를 실행하지 않으므로 <button> 만으로는 2페이지 이후로 가는
   * 크롤 경로가 존재하지 않는다. 그 결과 목록의 첫 20건을 뺀 나머지 상세 URL 이
   * 내부 링크 0 인 "사이트맵 전용 고아"가 된다.
   *
   * 미제공 시 기존 <button> 동작을 그대로 유지한다(하위호환).
   */
  hrefFor?: (page: number) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  pageChange: [page: number]
}>()

const isAtStart = computed(() => props.currentPage <= 1)
const isAtEnd = computed(() => props.currentPage >= props.totalPages)

function pageClass(page: number) {
  return [
    'pagination-btn min-w-[36px]',
    page === props.currentPage ? 'bg-primary text-white border-primary hover:bg-primary-dark' : '',
  ]
}

/**
 * 링크로 렌더된 경우의 클릭 처리.
 * 평범한 좌클릭은 기본 이동을 막고 기존 SPA 페이지 전환(pageChange)을 유지한다.
 * ctrl/cmd/shift/alt 클릭과 가운데 클릭은 막지 않아 "새 탭으로 열기"가 정상 동작한다.
 */
function onNavigate(event: MouseEvent, page: number) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (typeof event.button === 'number' && event.button !== 0) return
  event.preventDefault()
  emit('pageChange', page)
}

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  pages.push(1)
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')
  pages.push(total)

  return pages
})
</script>

<style scoped>
.pagination-btn {
  @apply flex items-center justify-center min-w-[44px] min-h-[44px] h-11 px-2 border border-line-2 rounded-lg text-sm font-medium text-muted hover:bg-background-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}
a.pagination-btn {
  @apply no-underline;
}
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
