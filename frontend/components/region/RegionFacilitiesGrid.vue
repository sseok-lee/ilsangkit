<template>
  <SectionBlock variant="flat" :heading="`${categoryName} 목록`" :subtext="`${districtName} 지역 ${categoryName} 정보`">
    <template #right>
      <span class="text-sm text-muted tabular-nums"><strong class="font-semibold text-ink">{{ (total || 0).toLocaleString('ko-KR') }}</strong>곳</span>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-10">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p class="mt-4 text-muted text-sm">{{ UI_MESSAGES.loading }}</p>
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
        <UiButton
          v-if="categorySlug"
          variant="primary"
          :to="`/${categorySlug}`"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">travel_explore</span>
          전국으로
        </UiButton>
      </EmptyState>

      <FacilityList
        v-else-if="variant === 'rows'"
        :facilities="facilities"
        :loading="false"
        variant="rows"
      />

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
import UiButton from '~/components/common/UiButton.vue'
import Pagination from '~/components/common/Pagination.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import FacilityList from '~/components/facility/FacilityList.vue'
import FacilityCard from '~/components/facility/FacilityCard.vue'
import type { Facility } from '~/types/facility'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'

withDefaults(defineProps<{
  categoryName: string
  districtName: string
  total: number
  loading: boolean
  error: string | null
  facilities: Facility[]
  currentPage: number
  totalPages: number
  categorySlug?: string
  variant?: 'cards' | 'rows'
  /** 주면 페이지네이션이 <a href> 로 렌더돼 크롤러가 2페이지 이후로 갈 수 있다. */
  hrefFor?: (page: number) => string
}>(), {
  variant: 'cards',
})

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'retry'): void
}>()
</script>
