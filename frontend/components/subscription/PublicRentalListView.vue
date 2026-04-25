<template>
  <div class="flex flex-col gap-3">
    <SectionBlock heading="LH 매입/전세임대" subtext="청약통장 없이도 자격만 맞으면 신청할 수 있는 LH 직접 공급 매물입니다.">
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ total.toLocaleString() }}건
        </span>
      </template>

      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="region in REGION_FILTERS"
          :key="region.slug ?? 'all'"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
            currentCity === region.slug
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-700 border-line hover:border-primary hover:text-primary'
          ]"
          @click="selectCity(region.slug)"
        >
          {{ region.label }}
        </button>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
          <div class="space-y-3">
            <div class="h-4 bg-slate-200 rounded w-2/3"></div>
            <div class="h-3 bg-slate-100 rounded w-full"></div>
            <div class="h-3 bg-slate-100 rounded w-3/4"></div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
        <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="reload"
        >
          다시 시도
        </button>
      </div>

      <div v-else-if="items.length === 0" class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-600 font-medium">조건에 맞는 매물이 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">지역 필터를 다른 값으로 바꿔보세요</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PublicRentalCard
          v-for="rental in items"
          :key="rental.id"
          :rental="rental"
        />
      </div>

      <Pagination
        v-if="totalPages > 1"
        :current-page="currentPage"
        :total-pages="totalPages"
        @page-change="goToPage"
      />
    </SectionBlock>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePublicRental } from '~/composables/usePublicRental'
import type { PublicRentalType } from '~/types/publicRental'

const props = defineProps<{
  rentalTypeCode?: PublicRentalType
}>()

const REGION_FILTERS: Array<{ slug?: string; label: string }> = [
  { label: '전국' },
  { slug: 'seoul', label: '서울' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'incheon', label: '인천' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
]

const { items, total, totalPages, currentPage, loading, error, fetchList } = usePublicRental()

const currentCity = ref<string | undefined>(undefined)
const page = ref(1)

const reload = (): Promise<void> => fetchList({
  city: currentCity.value,
  rentalType: props.rentalTypeCode,
  page: page.value,
  limit: 20,
})

function selectCity(slug: string | undefined) {
  currentCity.value = slug
  page.value = 1
  void reload()
}

function goToPage(p: number) {
  page.value = p
  void reload()
}

onMounted(() => {
  void reload()
})

watch(
  () => props.rentalTypeCode,
  () => {
    page.value = 1
    void reload()
  },
)
</script>
