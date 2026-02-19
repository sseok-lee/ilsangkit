<template>
  <div v-if="totalPages > 1" class="flex justify-center items-center gap-1 py-8">
    <!-- First page -->
    <button
      :disabled="currentPage === 1"
      class="pagination-btn"
      aria-label="첫 페이지"
      @click="$emit('pageChange', 1)"
    >
      <span class="material-symbols-outlined text-[18px]">first_page</span>
    </button>
    <!-- Previous -->
    <button
      :disabled="currentPage === 1"
      class="pagination-btn"
      aria-label="이전 페이지"
      @click="$emit('pageChange', currentPage - 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_left</span>
    </button>

    <!-- Page numbers -->
    <template v-for="page in visiblePages" :key="page">
      <span v-if="page === '...'" class="px-1 text-slate-400 text-sm">...</span>
      <button
        v-else
        :class="[
          'pagination-btn min-w-[36px]',
          page === currentPage ? 'bg-primary text-white border-primary hover:bg-primary-dark' : ''
        ]"
        :aria-label="`${page} 페이지`"
        :aria-current="page === currentPage ? 'page' : undefined"
        @click="$emit('pageChange', page as number)"
      >
        {{ page }}
      </button>
    </template>

    <!-- Next -->
    <button
      :disabled="currentPage === totalPages"
      class="pagination-btn"
      aria-label="다음 페이지"
      @click="$emit('pageChange', currentPage + 1)"
    >
      <span class="material-symbols-outlined text-[18px]">chevron_right</span>
    </button>
    <!-- Last page -->
    <button
      :disabled="currentPage === totalPages"
      class="pagination-btn"
      aria-label="마지막 페이지"
      @click="$emit('pageChange', totalPages)"
    >
      <span class="material-symbols-outlined text-[18px]">last_page</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
}

const props = defineProps<Props>()

defineEmits<{
  pageChange: [page: number]
}>()

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
  @apply flex items-center justify-center h-9 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed;
}
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
