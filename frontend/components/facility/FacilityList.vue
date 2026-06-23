<template>
  <div>
    <!-- Loading State - Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 5"
        :key="i"
        data-testid="skeleton"
        class="p-5 bg-white border border-slate-200 rounded-xl animate-pulse"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="h-7 w-24 bg-slate-200 rounded-full"></div>
          <div class="h-6 w-16 bg-slate-200 rounded-full"></div>
        </div>
        <div class="h-6 bg-slate-200 rounded mb-2 w-3/4"></div>
        <div class="h-4 bg-slate-200 rounded w-full"></div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="!loading && facilities.length === 0"
      :title="UI_MESSAGES.emptySearch"
      description="다른 검색어나 필터로 다시 시도해보세요"
    >
      <button
        class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        @click="emit('reset')"
      >
        <span class="material-symbols-outlined text-[16px]">refresh</span>
        필터 초기화
      </button>
    </EmptyState>

    <!-- Facility List -->
    <div v-else class="space-y-4">
      <FacilityCard
        v-for="facility in facilities"
        :key="facility.id"
        :facility="facility"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Facility } from '~/types/facility'
import { UI_MESSAGES } from '~/utils/uiMessages'
import EmptyState from '~/components/common/EmptyState.vue'

interface Props {
  facilities: Facility[]
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'reset'): void
}>()
</script>
