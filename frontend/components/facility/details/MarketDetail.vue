<template>
  <div class="space-y-3">
    <!-- 시장유형 + 개장주기 뱃지 -->
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="details.marketType"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="marketTypeBadgeClass"
      >
        {{ details.marketType }}
      </span>
      <span
        v-if="details.openingCycle"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800"
      >
        {{ openingCycleLabel }}
      </span>
    </div>

    <DetailRow
      v-if="details.storeCount !== undefined && details.storeCount !== null"
      label="점포 수"
      :value="`${details.storeCount.toLocaleString()}개`"
    />
    <DetailRow
      v-if="details.foundedYear !== undefined && details.foundedYear !== null"
      label="개설연도"
      :value="`${details.foundedYear}년`"
    />
    <DetailRow
      v-if="details.phoneNumber"
      label="연락처"
      :value="details.phoneNumber"
      type="phone"
    />

    <!-- 주요 판매 품목 -->
    <div v-if="productTags.length" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-2">주요 판매품목</p>
      <div class="flex flex-wrap gap-1">
        <span v-for="tag in productTags" :key="tag" class="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs">{{ tag }}</span>
      </div>
    </div>

    <!-- 편의시설 -->
    <div v-if="details.hasPublicToilet !== undefined && details.hasPublicToilet !== null || details.hasParking !== undefined && details.hasParking !== null" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-2">편의시설</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-if="details.hasPublicToilet !== undefined && details.hasPublicToilet !== null" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.hasPublicToilet ? 'text-green-600' : 'text-gray-400'">{{ details.hasPublicToilet ? '✓' : '✗' }}</span>
          <span>공중화장실</span>
        </div>
        <div v-if="details.hasParking !== undefined && details.hasParking !== null" class="flex items-center gap-1.5 text-sm text-gray-700">
          <span :class="details.hasParking ? 'text-green-600' : 'text-gray-400'">{{ details.hasParking ? '✓' : '✗' }}</span>
          <span>주차시설</span>
        </div>
      </div>
    </div>

    <!-- 홈페이지 -->
    <div v-if="details.homepageUrl" class="flex flex-row py-2 border-b border-gray-100 last:border-0 gap-4">
      <dt class="text-xs font-medium text-gray-500 min-w-[7rem] shrink-0 pt-0.5">홈페이지</dt>
      <dd class="text-sm text-gray-900">
        <a
          :href="details.homepageUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary font-medium underline"
        >
          {{ details.homepageUrl }}
        </a>
      </dd>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MarketDetails } from '~/types/facility'

const props = defineProps<{
  details: MarketDetails
}>()

const marketTypeBadgeClass = computed(() => {
  const type = props.details.marketType || ''
  if (type.includes('상설')) return 'bg-blue-100 text-blue-800'
  return 'bg-orange-100 text-orange-800'
})

const openingCycleLabel = computed(() => {
  const cycle = props.details.openingCycle || ''
  if (cycle === '매일') return '매일'
  // 날짜 기반 (e.g. "1일+6일") → "매월 1일, 6일"
  if (/\d/.test(cycle)) {
    const days = cycle.split('+').map(s => s.trim()).filter(Boolean)
    return `매월 ${days.join(', ')}`
  }
  return cycle
})

const productTags = computed(() =>
  props.details.products?.split('+').map(s => s.trim()).filter(Boolean) ?? []
)
</script>
