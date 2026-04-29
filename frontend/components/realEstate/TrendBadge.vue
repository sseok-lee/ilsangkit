<template>
  <span v-if="display" :class="['inline-flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5', toneClass]">
    <span aria-hidden="true">{{ arrow }}</span>
    <span>{{ formatted }}</span>
  </span>
  <span v-else class="text-[11px] text-slate-400 font-medium">— 보합</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  ratio: number | null | undefined
  /** 0에 가까운 값(±0.5%)을 보합으로 처리할지 */
  flatThreshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  flatThreshold: 0.005,
})

const display = computed(() => {
  if (props.ratio === null || props.ratio === undefined) return false
  return Math.abs(props.ratio) >= props.flatThreshold
})

const formatted = computed(() => {
  if (props.ratio === null || props.ratio === undefined) return ''
  const pct = Math.abs(props.ratio * 100)
  return `${pct.toFixed(1)}%`
})

const arrow = computed(() => {
  if (props.ratio === null || props.ratio === undefined) return ''
  return props.ratio > 0 ? '▲' : '▼'
})

const toneClass = computed(() => {
  if (props.ratio === null || props.ratio === undefined) return ''
  return props.ratio > 0
    ? 'bg-red-50 text-red-600'
    : 'bg-emerald-50 text-emerald-600'
})
</script>
