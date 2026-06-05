<!-- frontend/components/auction/AuctionPriceCompare.vue -->
<script setup lang="ts">
// 같은 동(또는 시군구) 실거래가 평균을 받아 감정가와 비교. 데이터는 부모가 주입.
import { computed } from 'vue'
import { formatWonKorean } from '~/types/auction'
const props = defineProps<{ apslAssAmt: number | null; marketAvg: number | null; marketLabel: string }>()
const diff = computed(() => {
  if (props.apslAssAmt == null || props.marketAvg == null || props.marketAvg <= 0) return null
  return Math.round((props.apslAssAmt / props.marketAvg - 1) * 100)
})
</script>
<template>
  <div v-if="marketAvg != null" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-2">실거래가 시세 비교</h3>
    <p class="text-sm text-slate-600">{{ marketLabel }} 평균 실거래가 <b>{{ formatWonKorean(marketAvg) }}</b></p>
    <p v-if="diff != null" class="text-sm mt-1">감정가는 시세 대비
      <b :class="diff <= 0 ? 'text-emerald-700' : 'text-rose-600'">{{ diff > 0 ? '+' : '' }}{{ diff }}%</b>
    </p>
  </div>
</template>
