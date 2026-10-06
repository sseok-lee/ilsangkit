<template>
  <dl class="summary-row" :class="{ 'summary-row--lead': lead }" :style="{ '--summary-cols': Math.min(items.length, 4) }">
    <div v-for="item in items" :key="item.label" class="summary-row__item">
      <dt class="summary-row__label">{{ item.label }}</dt>
      <dd class="summary-row__value" :class="item.tone ? TONE_CLASS[item.tone] : undefined">{{ item.value }}<span v-if="item.unit" class="summary-row__unit">{{ item.unit }}</span></dd>
      <dd v-if="item.note" class="summary-row__note">{{ item.note }}</dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
// 상세 화면 전용(스펙 2026-10-02 §3.5). 목록 페이지 머리에는 쓰지 않는다(D6).
export interface SummaryItem {
  label: string
  value: string | number
  unit?: string
  note?: string // 값 아래 보조 줄(예: 최근 매매의 날짜·면적·층)
  tone?: 'brand' | 'success' | 'danger' | 'delta-up' | 'delta-down'
}

// 리터럴 맵 — 조립하면 Tailwind 퍼지에서 빠진다.
const TONE_CLASS = {
  brand: 'summary-row__value--brand',
  success: 'summary-row__value--success',
  danger: 'summary-row__value--danger',
  'delta-up': 'summary-row__value--delta-up',
  'delta-down': 'summary-row__value--delta-down',
} as const

withDefaults(defineProps<{
  items: SummaryItem[]
  // 첫 칸 강조(단지 상세 최근 매매). 4칸 전용 — 데스크톱 열 비율이 고정이다.
  lead?: boolean
}>(), { lead: false })
</script>
