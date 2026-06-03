<template>
  <div class="flex flex-col gap-3">
    <!-- 상태와 지역 -->
    <SectionBlock heading="상태와 지역" subtext="시간성이 있는 청약이므로 상태 칩을 먼저 선택하세요.">
      <!-- Status Chips -->
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          v-for="tab in STATUS_ORDER"
          :key="tab.key ?? 'all'"
          :class="[
            'px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors border',
            currentStatus === tab.key
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-700 border-line hover:border-primary hover:text-primary'
          ]"
          @click="selectStatus(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Region Filter -->
      <RegionCascadingDropdown
        v-model:city="selectedRegion"
        v-model:district="selectedDistrict"
      />
    </SectionBlock>

    <!-- Ad (필터 이후) -->
    <AdBanner />

    <!-- Loading State -->
    <SectionBlock v-if="pending" :heading="`${getStatusLabel(currentStatus) || '전체'} 청약`">
      <LoadingSkeleton variant="card" :footer="true" />
    </SectionBlock>

    <!-- Error State -->
    <SectionBlock v-else-if="error" heading="오류">
      <div class="rounded-xl bg-red-50 p-8 text-center">
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
    </SectionBlock>

    <!-- Empty State -->
    <SectionBlock v-else-if="subscriptions.length === 0" :heading="`${getStatusLabel(currentStatus) || '전체'} 청약`">
      <div class="rounded-xl bg-slate-50 p-12 text-center">
        <span class="material-symbols-outlined text-[48px] text-slate-300 block mb-3">apartment</span>
        <p class="text-slate-600 font-medium">조건에 맞는 청약이 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">다른 조건으로 다시 검색해보세요</p>
      </div>
    </SectionBlock>

    <!-- Subscription List -->
    <SectionBlock
      v-else
      :heading="`${getStatusLabel(currentStatus) || '전체'} 청약`"
      subtext="마감 D-day와 접수 기간을 먼저 확인하세요."
    >
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ total.toLocaleString() }}건
        </span>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SubscriptionCard v-for="sub in subscriptions" :key="sub.id" :subscription="sub" />
      </div>
      <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
    </SectionBlock>

    <!-- Ad: 하단 -->
    <AdBanner />
  </div>
</template>

<script setup lang="ts">
import type { Subscription, SubscriptionSourceType } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'
import SectionBlock from '~/components/common/SectionBlock.vue'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'

/// 상태 칩 순서: 전체 → 청약중 → 청약예정 → 마감
const STATUS_ORDER: { key: 'ongoing' | 'upcoming' | null | 'closed'; label: string }[] = [
  { key: null, label: '전체' },
  { key: 'ongoing', label: '청약중' },
  { key: 'upcoming', label: '청약예정' },
  { key: 'closed', label: '마감' },
]

const props = defineProps<{
  category?: 'sale' | 'rent'
  sourceType?: SubscriptionSourceType
  rentType?: string
}>()

const { getSubscriptionList } = useSubscription()

const currentStatus = ref<'upcoming' | 'ongoing' | 'closed' | null>(null)
const selectedRegion = ref('')
const selectedDistrict = ref('')
const currentPage = ref(1)

const subscriptions = ref<Subscription[]>([])
const total = ref(0)
const totalPages = ref(0)
const pending = ref(false)
const error = ref<string | null>(null)

watch([currentStatus, selectedRegion, selectedDistrict], () => {
  currentPage.value = 1
  loadSubscriptions()
})

function selectStatus(key: 'ongoing' | 'upcoming' | 'closed' | null) {
  if (currentStatus.value === key) {
    currentPage.value = 1
    loadSubscriptions()
    return
  }
  currentStatus.value = key
}

watch(currentPage, () => {
  loadSubscriptions()
})

async function loadSubscriptions() {
  pending.value = true
  error.value = null
  try {
    const region = [selectedRegion.value, selectedDistrict.value].filter(Boolean).join(' ') || undefined
    const result = await getSubscriptionList({
      status: currentStatus.value ?? undefined,
      region,
      sourceType: props.sourceType,
      rentType: props.rentType,
      category: props.sourceType ? undefined : props.category,
      page: currentPage.value,
      limit: 18,
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
  if (status === 'ongoing') return '청약중'
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
    limit: 18,
  })
)

if (data.value) {
  subscriptions.value = data.value.items
  total.value = data.value.total
  totalPages.value = data.value.totalPages
}
</script>
