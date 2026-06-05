<!-- frontend/components/auction/AuctionStatusBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { statusLabel, type AuctionStatus } from '~/types/auction'
const props = defineProps<{ status: AuctionStatus | string }>()
const label = computed(() => statusLabel(props.status))
const cls = computed(() => {
  switch (props.status) {
    case 'ongoing': return 'bg-primary-50 text-primary'
    case 'scheduled': return 'bg-amber-50 text-amber-700'
    case 'sold': return 'bg-emerald-50 text-emerald-700'
    case 'failed': return 'bg-slate-100 text-slate-600'
    case 'cancelled': return 'bg-rose-50 text-rose-700'
    default: return 'bg-slate-100 text-slate-600'
  }
})
</script>
<template>
  <span :class="['inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', cls]">{{ label }}</span>
</template>
