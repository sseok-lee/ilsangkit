<template>
  <div>
    <!-- Loading State - Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 5"
        :key="i"
        data-testid="skeleton"
        class="p-5 bg-white border border-gray-200 rounded-xl animate-pulse"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="h-7 w-24 bg-gray-200 rounded-full"></div>
          <div class="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div class="h-6 bg-gray-200 rounded mb-2 w-3/4"></div>
        <div class="h-4 bg-gray-200 rounded w-full"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!loading && facilities.length === 0"
      class="flex flex-col items-center justify-center py-16 px-4"
    >
      <div class="text-6xl mb-4">🔍</div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">검색 결과가 없습니다</h3>
      <p class="text-gray-600 text-center">
        다른 검색어나 필터로 다시 시도해보세요
      </p>
    </div>

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

interface Props {
  facilities: Facility[]
  loading: boolean
}

defineProps<Props>()
</script>
