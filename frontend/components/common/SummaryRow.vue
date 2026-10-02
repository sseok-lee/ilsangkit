<template>
  <dl class="summary-row" :style="{ '--summary-cols': Math.min(items.length, 4) }">
    <div v-for="item in items" :key="item.label" class="summary-row__item">
      <dt class="summary-row__label">{{ item.label }}</dt>
      <dd class="summary-row__value">{{ item.value }}<span v-if="item.unit" class="summary-row__unit">{{ item.unit }}</span></dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
// 상세 화면 전용(스펙 2026-10-02 §3.5). 목록 페이지 머리에는 쓰지 않는다(D6).
export interface SummaryItem {
  label: string
  value: string | number
  unit?: string
}

defineProps<{ items: SummaryItem[] }>()
</script>
