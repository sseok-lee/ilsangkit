<template>
  <section
    class="bg-white rounded-xl p-5 shadow-sm border border-slate-200"
    aria-label="지역 요약"
  >
    <!-- 헤더 -->
    <div class="flex items-start justify-between flex-wrap gap-2 mb-4">
      <div>
        <h2 class="text-slate-900 text-lg font-bold">
          {{ districtName }} {{ categoryLabel }} 요약
        </h2>
        <p v-if="relativeUpdated" class="text-xs text-slate-500 mt-0.5">
          업데이트: {{ relativeUpdated }}
        </p>
      </div>
      <div v-if="summary.countDiff > 0" class="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
        <span aria-hidden="true">↑</span>
        <span>최근 30일 +{{ summary.countDiff }}</span>
      </div>
    </div>

    <!-- 총 시설 수 -->
    <div class="mb-5">
      <p class="text-[11px] text-slate-500 tracking-wide font-medium">총 시설</p>
      <p class="text-slate-900 font-bold">
        <span class="text-3xl">{{ summary.count.toLocaleString() }}</span>
        <span class="text-base text-slate-600 ml-1">곳</span>
      </p>
    </div>

    <!-- Highlights (인라인 summary-grid) -->
    <div
      v-if="summary.highlights.length > 0"
      class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-line"
    >
      <div v-for="h in summary.highlights" :key="h.key">
        <span class="block text-slate-500 text-xs font-bold truncate">{{ h.label }}</span>
        <div class="flex items-baseline gap-1.5 mt-1">
          <strong class="text-lg md:text-xl font-bold text-slate-900">{{ h.count.toLocaleString() }}</strong>
          <span class="text-sm text-slate-500">곳</span>
          <span class="ml-auto text-xs font-semibold text-primary">{{ h.percent }}%</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Highlight {
  key: string
  label: string
  count: number
  percent: number
}

interface Summary {
  count: number
  countDiff: number
  highlights: Highlight[]
  lastSyncedAt: string | null
}

interface Props {
  summary: Summary
  districtName: string
  categoryLabel: string
}

const props = defineProps<Props>()

/**
 * 상대 시간 표기 — SSR/CSR 동일하도록 날짜 기준 계산 (시간 단위는 피함)
 * "오늘", "1일 전", "3주 전" 등
 */
const relativeUpdated = computed(() => {
  if (!props.summary.lastSyncedAt) return ''
  const synced = new Date(props.summary.lastSyncedAt)
  if (Number.isNaN(synced.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - synced.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return '방금'
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return `${Math.floor(diffDays / 365)}년 전`
})
</script>
