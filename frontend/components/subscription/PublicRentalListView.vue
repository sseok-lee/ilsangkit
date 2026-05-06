<template>
  <div class="flex flex-col gap-3">
    <SectionBlock heading="LH 매입/전세임대" subtext="청약통장 없이도 자격만 맞으면 신청할 수 있는 LH 직접 공급 매물입니다.">
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ total.toLocaleString() }}건
        </span>
      </template>

      <!-- 지역 필터: 청약 페이지(SubscriptionListView) 와 동일 패턴 -->
      <div class="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
          <div class="relative">
            <select
              v-model="currentCity"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">전국</option>
              <option v-for="opt in CITY_OPTIONS" :key="opt.slug" :value="opt.slug">{{ opt.label }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">지역 (상세)</label>
          <input
            v-model="districtDetail"
            type="text"
            placeholder="예: 강남구, 분당구"
            class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
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

// 모든 광역시·도 (slug, label) — 청약 select 와 동일한 옵션셋 + 도 단위까지 포함.
const CITY_OPTIONS = [
  { slug: 'seoul', label: '서울' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
  { slug: 'incheon', label: '인천' },
  { slug: 'gwangju', label: '광주' },
  { slug: 'daejeon', label: '대전' },
  { slug: 'ulsan', label: '울산' },
  { slug: 'sejong', label: '세종' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'gangwon', label: '강원' },
  { slug: 'chungbuk', label: '충북' },
  { slug: 'chungnam', label: '충남' },
  { slug: 'jeonbuk', label: '전북' },
  { slug: 'jeonnam', label: '전남' },
  { slug: 'gyeongbuk', label: '경북' },
  { slug: 'gyeongnam', label: '경남' },
  { slug: 'jeju', label: '제주' },
]

const { items, total, totalPages, currentPage, loading, error, fetchList } = usePublicRental()

const currentCity = ref<string>('')
const districtDetail = ref<string>('')
const page = ref(1)

const reload = (): Promise<void> => fetchList({
  city: currentCity.value || undefined,
  district: districtDetail.value.trim() || undefined,
  rentalType: props.rentalTypeCode,
  page: page.value,
  limit: 18,
})

function goToPage(p: number) {
  page.value = p
  void reload()
}

onMounted(() => {
  void reload()
})

watch([currentCity, () => props.rentalTypeCode], () => {
  page.value = 1
  void reload()
})

// 상세 검색 입력은 디바운스 — 타이핑마다 호출 방지.
let detailTimer: ReturnType<typeof setTimeout> | null = null
watch(districtDetail, () => {
  if (detailTimer) clearTimeout(detailTimer)
  detailTimer = setTimeout(() => {
    page.value = 1
    void reload()
  }, 300)
})
</script>
