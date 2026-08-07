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
      <p class="mt-4 text-slate-500 text-sm">{{ UI_MESSAGES.loading }}</p>
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
      <EmptyState
        v-if="facilities.length === 0"
        :title="emptyFiltered('시설')"
        description="다른 지역이나 카테고리를 선택해보세요"
      >
        <NuxtLink
          v-if="categorySlug"
          :to="`/${categorySlug}`"
          class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">travel_explore</span>
          전국으로
        </NuxtLink>
      </EmptyState>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FacilityCard
          v-for="facility in facilities"
          :key="facility.id"
          :facility="facility"
        />
      </div>

      <!-- Pagination -->
      <Pagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :href-for="hrefFor"
        @page-change="(page) => emit('page-change', page)"
      />
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import Pagination from '~/components/common/Pagination.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import type { Facility } from '~/types/facility'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'

defineProps<{
  categoryName: string
  districtName: string
  total: number
  loading: boolean
  error: string | null
  facilities: Facility[]
  currentPage: number
  totalPages: number
  categorySlug?: string
  /** 주면 페이지네이션이 <a href> 로 렌더돼 크롤러가 2페이지 이후로 갈 수 있다. */
  hrefFor?: (page: number) => string
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'retry'): void
}>()
</script>
