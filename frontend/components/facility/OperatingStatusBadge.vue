<template>
  <span
    :class="[
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md',
      statusClasses,
    ]"
  >
    <span :class="['w-1.5 h-1.5 rounded-full', dotColor]"></span>
    {{ statusLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited'

interface Props {
  status: OperatingStatus
}

const props = defineProps<Props>()

const statusClasses = computed(() => {
  switch (props.status) {
    case 'open24h':
      return 'text-slate-700 bg-slate-100'
    case 'openNow':
      return 'text-slate-700 bg-slate-100'
    case 'closed':
      return 'text-slate-500 bg-slate-100'
    case 'limited':
      return 'text-slate-600 bg-slate-100'
    default:
      return 'text-slate-600 bg-slate-100'
  }
})

const dotColor = computed(() => {
  switch (props.status) {
    case 'open24h':
      return 'bg-green-500'
    case 'openNow':
      return 'bg-green-500'
    case 'closed':
      return 'bg-red-400'
    case 'limited':
      return 'bg-amber-500'
    default:
      return 'bg-slate-400'
  }
})

const statusLabel = computed(() => {
  switch (props.status) {
    case 'open24h':
      return '24시간'
    case 'openNow':
      return '개방중'
    case 'closed':
      return '영업종료'
    case 'limited':
      return '시간제한'
    default:
      return ''
  }
})
</script>
