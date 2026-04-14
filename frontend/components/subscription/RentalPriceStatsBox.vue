<template>
  <div v-if="pending" class="bg-blue-50 rounded-xl border border-blue-100 p-5 mb-6 animate-pulse">
    <div class="h-6 bg-blue-200 rounded w-1/3 mb-4"></div>
    <div class="grid grid-cols-2 gap-4">
      <div class="h-20 bg-blue-200 rounded"></div>
      <div class="h-20 bg-blue-200 rounded"></div>
    </div>
  </div>

  <div v-else-if="!hasData" class="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-6">
    <p class="text-slate-400 text-sm text-center">해당 지역 시세 데이터가 없습니다</p>
  </div>

  <div v-else class="bg-blue-50 rounded-xl border border-blue-100 p-5 mb-6">
    <!-- Header -->
    <div class="mb-4">
      <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
        <span>📊 주변 아파트 전월세 시세</span>
        <span v-if="stats?.period" class="text-xs text-slate-500">({{ stats.period }})</span>
      </h3>
      <p class="text-xs text-slate-500 mt-1">지역: {{ regionName }}</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-4">
      <!-- 전세 -->
      <div class="bg-white rounded-lg p-4 border border-blue-200">
        <p class="text-xs font-semibold text-slate-600 mb-2">전세</p>
        <p class="text-lg font-bold text-slate-900">
          {{ stats?.jeonsae?.avgDeposit ? formatDeposit(stats.jeonsae.avgDeposit) : '-' }}
        </p>
        <p class="text-xs text-slate-500 mt-1">
          거래 {{ stats?.jeonsae?.count ?? 0 }}건
        </p>
      </div>

      <!-- 월세 -->
      <div class="bg-white rounded-lg p-4 border border-blue-200">
        <p class="text-xs font-semibold text-slate-600 mb-2">월세</p>
        <div class="space-y-1">
          <p class="text-sm font-bold text-slate-900">
            보증금 {{ stats?.wolse?.avgDeposit ? formatDeposit(stats.wolse.avgDeposit) : '-' }}
          </p>
          <p class="text-sm font-bold text-slate-900">
            월 {{ stats?.wolse?.avgMonthlyRent ? formatMonthlyRent(stats.wolse.avgMonthlyRent) : '-' }}
          </p>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          거래 {{ stats?.wolse?.count ?? 0 }}건
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatDeposit } from '~/utils/formatDeposit'

interface RentalPriceStats {
  jeonsae: {
    avgDeposit: number | null
    count: number
  }
  wolse: {
    avgDeposit: number | null
    avgMonthlyRent: number | null
    count: number
  }
  period: string
}

const props = defineProps<{
  subscriptionId: number
  regionName: string
}>()

const stats = ref<RentalPriceStats | null>(null)
const pending = ref(true)

const hasData = computed(() => {
  return (
    (stats.value?.jeonsae?.count ?? 0) > 0 || (stats.value?.wolse?.count ?? 0) > 0
  )
})

async function loadStats() {
  try {
    pending.value = true
    const response = await $fetch(`/api/subscription/${props.subscriptionId}/rental-price-stats`, {
      method: 'GET',
    })
    if (response?.success && response?.data) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('Failed to load rental price stats:', error)
  } finally {
    pending.value = false
  }
}

function formatMonthlyRent(monthlyRent: number): string {
  return `${monthlyRent.toLocaleString()}만원`
}

onMounted(() => {
  loadStats()
})
</script>
