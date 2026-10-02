<template>
  <section aria-label="지역 요약">
    <div class="flex items-start justify-between flex-wrap gap-2 mb-3">
      <div>
        <h3 class="ui-h3 text-strong">{{ districtName }} {{ categoryLabel }} 요약</h3>
        <p v-if="relativeUpdated" class="text-[13px] text-muted mt-0.5">업데이트: {{ relativeUpdated }}</p>
      </div>
      <div v-if="summary.countDiff > 0" class="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
        <span aria-hidden="true">↑</span>
        <span>최근 30일 +{{ summary.countDiff }}</span>
      </div>
    </div>
    <dl class="border-t border-line text-sm">
      <div class="flex items-center justify-between gap-3 py-2.5 border-b border-line">
        <dt class="text-muted">총 시설</dt>
        <dd class="font-semibold text-ink tabular-nums">{{ summary.count.toLocaleString() }}곳</dd>
      </div>
      <div
        v-for="h in summary.highlights"
        :key="h.key"
        class="flex items-center justify-between gap-3 py-2.5 border-b border-line"
      >
        <dt class="min-w-0 truncate text-muted">{{ h.label }}</dt>
        <dd class="shrink-0 text-ink tabular-nums">
          {{ h.count.toLocaleString() }}곳<span class="ml-1.5 font-semibold text-primary">{{ h.percent }}%</span>
        </dd>
      </div>
    </dl>
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
