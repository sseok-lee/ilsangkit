<template>
  <div>
    <!-- Status Tabs -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        :class="[
          'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
          currentStatus === null
            ? 'bg-primary text-white'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        ]"
        @click="currentStatus = null"
      >
        전체
      </button>
      <button
        v-for="tab in ['upcoming', 'ongoing', 'closed']"
        :key="tab"
        :class="[
          'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
          currentStatus === tab
            ? 'bg-primary text-white'
            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        ]"
        @click="currentStatus = tab as 'upcoming' | 'ongoing' | 'closed'"
      >
        {{ getStatusLabel(tab) }}
      </button>
    </div>

    <!-- Filter Section -->
    <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
          <div class="relative">
            <select
              v-model="selectedRegion"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">전국</option>
              <option value="서울">서울</option>
              <option value="경기">경기</option>
              <option value="인천">인천</option>
              <option value="대전">대전</option>
              <option value="대구">대구</option>
              <option value="부산">부산</option>
              <option value="광주">광주</option>
              <option value="울산">울산</option>
              <option value="세종">세종</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">지역 (상세)</label>
          <div class="relative">
            <input
              v-model="regionDetail"
              type="text"
              placeholder="예: 강남, 분당"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
        <div class="space-y-3">
          <div class="h-4 bg-slate-200 rounded w-2/3"></div>
          <div class="h-3 bg-slate-100 rounded w-full"></div>
          <div class="h-3 bg-slate-100 rounded w-3/4"></div>
          <div class="h-8 bg-slate-200 rounded w-24 mt-4"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
      <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
        <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
      </div>
      <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
      <button
        class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        @click="loadSubscriptions"
      >
        <span class="material-symbols-outlined text-[16px]">refresh</span>
        다시 시도
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="subscriptions.length === 0" class="rounded-xl bg-slate-50 p-12 text-center">
      <span class="material-symbols-outlined text-[48px] text-slate-300 block mb-3">home_work</span>
      <p class="text-slate-600 font-medium">조건에 맞는 청약이 없습니다</p>
      <p class="text-slate-500 text-sm mt-1">다른 조건으로 다시 검색해보세요</p>
    </div>

    <!-- Subscription List -->
    <div v-else class="space-y-6">
      <AdBanner />
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-slate-800">
          {{ getStatusLabel(currentStatus) }} 청약
        </h2>
        <span class="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
          {{ total.toLocaleString() }}건
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <template v-for="(sub, index) in subscriptions" :key="sub.id">
          <SubscriptionCard :subscription="sub" />
          <div v-if="(index + 1) % 6 === 0" class="col-span-full">
            <AdBanner ad-slot="2345678901" ad-format="fluid" />
          </div>
        </template>
      </div>

      <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
    </div>

    <AdBanner />
  </div>
</template>

<script setup lang="ts">
import type { Subscription, SubscriptionSourceType } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'

const props = defineProps<{
  category?: 'sale' | 'rent'
  sourceType?: SubscriptionSourceType
  rentType?: string
}>()

const { getSubscriptionList } = useSubscription()

const currentStatus = ref<'upcoming' | 'ongoing' | 'closed' | null>(null)
const selectedRegion = ref('')
const regionDetail = ref('')
const currentPage = ref(1)

const subscriptions = ref<Subscription[]>([])
const total = ref(0)
const totalPages = ref(0)
const pending = ref(false)
const error = ref<string | null>(null)

watch([currentStatus, selectedRegion, regionDetail], () => {
  currentPage.value = 1
  loadSubscriptions()
})

watch(currentPage, () => {
  loadSubscriptions()
})

async function loadSubscriptions() {
  pending.value = true
  error.value = null
  try {
    const region = [selectedRegion.value, regionDetail.value].filter(Boolean).join(' ') || undefined
    const result = await getSubscriptionList({
      status: currentStatus.value ?? undefined,
      region,
      sourceType: props.sourceType,
      rentType: props.rentType,
      category: props.sourceType ? undefined : props.category,
      page: currentPage.value,
      limit: 20,
    })
    subscriptions.value = result.items
    total.value = result.total
    totalPages.value = result.totalPages
  } catch (err) {
    error.value = '청약 정보를 불러올 수 없습니다'
    // eslint-disable-next-line no-console
    console.error('Failed to load subscriptions:', err)
  } finally {
    pending.value = false
  }
}

function goToPage(page: number) {
  currentPage.value = page
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  if (status === 'closed') return '마감'
  return ''
}

// SSR: Load initial data
const { data } = await useAsyncData(
  `subscription-${props.category || props.sourceType || 'all'}`,
  () => getSubscriptionList({
    status: undefined,
    sourceType: props.sourceType,
    rentType: props.rentType,
    category: props.sourceType ? undefined : props.category,
    page: 1,
    limit: 20,
  })
)

if (data.value) {
  subscriptions.value = data.value.items
  total.value = data.value.total
  totalPages.value = data.value.totalPages
}
</script>
