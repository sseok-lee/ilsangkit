<template>
  <SectionBlock :heading="`${categoryName} 목록`" :subtext="`${districtName} 지역 ${categoryName} 정보`">
    <template #right>
      <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {{ (total || 0).toLocaleString('ko-KR') }}건
      </span>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p class="mt-4 text-slate-500 text-sm">시설 정보를 불러오는 중...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p class="text-red-800">{{ error }}</p>
      <button
        class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        @click="emit('retry')"
      >
        다시 시도
      </button>
    </div>

    <!-- Facilities Grid -->
    <div v-else>
      <div v-if="facilities.length === 0" class="py-12 text-center">
        <p class="text-slate-600">해당 지역에 등록된 시설이 없습니다.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FacilityCard
          v-for="facility in facilities"
          :key="facility.id"
          :facility="facility"
        />
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-4">
        <button
          :disabled="currentPage === 1"
          class="px-4 py-2 border border-line rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          @click="emit('page-change', currentPage - 1)"
        >
          이전
        </button>
        <span class="text-slate-700 text-sm">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage === totalPages"
          class="px-4 py-2 border border-line rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          @click="emit('page-change', currentPage + 1)"
        >
          다음
        </button>
      </div>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { Facility } from '~/types/facility'

defineProps<{
  categoryName: string
  districtName: string
  total: number
  loading: boolean
  error: string | null
  facilities: Facility[]
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'retry'): void
}>()
</script>
