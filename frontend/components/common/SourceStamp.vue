<template>
  <span
    class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-faint md:text-xs"
    :class="capsule ? 'md:rounded-full md:border md:border-line md:bg-surface-light md:px-3 md:py-1' : ''"
  >
    <span v-if="showDate" class="size-1.5 shrink-0 rounded-full bg-success" aria-hidden="true"></span>
    <span class="font-bold text-muted">{{ provider }}</span>
    <template v-if="basis">
      <span aria-hidden="true"> · </span>
      <span>{{ basis }}</span>
    </template>
    <template v-if="showDate">
      <span aria-hidden="true"> · </span>
      <span class="tabular-nums">{{ displayDate }} 동기화</span>
    </template>
    <template v-if="sourceUrl">
      <span aria-hidden="true"> · </span>
      <a
        :href="sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold text-primary hover:underline"
      >{{ linkLabel }} ↗</a>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDotDate, isSyncStale } from '~/utils/syncFreshness'

const props = withDefaults(defineProps<{
  /** 제공 기관명 */
  provider: string
  /** 산출 조건·기준 텍스트 (예: '기준 2026.06', '전체 기간 누적') — 접두어 없이 그대로 렌더 */
  basis?: string | null
  /** 마지막 동기화 시각 ISO — stale이면 날짜·상태점 자동 숨김 */
  syncedAt?: string | null
  sourceUrl?: string | null
  linkLabel?: string
  /** capsule: md 이상 알약형(미만 자동 plain) / plain: 항상 텍스트형 */
  variant?: 'capsule' | 'plain'
  /** 신선도 한계(일): 부동산·청약 2, trash 3, 시설 62 */
  staleDays?: number
}>(), {
  basis: null,
  syncedAt: null,
  sourceUrl: null,
  linkLabel: '원본 보기',
  variant: 'capsule',
  staleDays: 62,
})

const capsule = computed(() => props.variant === 'capsule')
const displayDate = computed(() => formatDotDate(props.syncedAt))
const showDate = computed(() => !!displayDate.value && !isSyncStale(props.syncedAt, props.staleDays))
</script>
