<template>
  <div class="flex flex-wrap gap-1.5 p-2 bg-white/95 backdrop-blur rounded-xl border border-line shadow-card">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      class="px-3 py-1.5 min-h-[44px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
      :class="opt.value === props.type
        ? 'bg-primary text-white'
        : 'bg-background-light text-slate-700 hover:bg-slate-200'"
      :aria-pressed="opt.value === props.type"
      @click="emit('update:type', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
// 거래 축은 매매/전월세 2종이다. 전세/월세로 나누지 않는 이유는 설계문서 4장 참조 —
// summary 가 건물당 최신 1건만 보유해 전세 필터 시 아파트 44.6%·오피스텔 56.4%가 누락된다.
const OPTIONS = [
  { value: 'apt-sale', label: '아파트 매매' },
  { value: 'apt-rent', label: '아파트 전월세' },
  { value: 'villa-sale', label: '빌라 매매' },
  { value: 'villa-rent', label: '빌라 전월세' },
  { value: 'offitel-sale', label: '오피스텔 매매' },
  { value: 'offitel-rent', label: '오피스텔 전월세' },
] as const

const props = defineProps<{ type: string }>()
const emit = defineEmits<{ 'update:type': [string] }>()
</script>
