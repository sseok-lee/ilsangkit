<template>
  <div v-if="total > 0" data-testid="rent-ratio">
    <div class="flex h-6 w-full overflow-hidden rounded-lg text-xs font-bold">
      <div class="flex items-center justify-center bg-primary text-white" :style="{ width: jeonsePct + '%' }">
        전세 {{ jeonsePct }}%
      </div>
      <div class="flex items-center justify-center bg-primary-100 text-primary-700" :style="{ width: (100 - jeonsePct) + '%' }">
        월세 {{ 100 - jeonsePct }}%
      </div>
    </div>
    <p class="mt-1 text-xs text-slate-500">최근 거래 기준 전세 {{ jeonseCount }}건 · 월세 {{ wolseCount }}건</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ jeonseCount?: number; wolseCount?: number }>(), {
  jeonseCount: 0,
  wolseCount: 0,
})

const total = computed(() => props.jeonseCount + props.wolseCount)
const jeonsePct = computed(() => (total.value === 0 ? 0 : Math.round((props.jeonseCount / total.value) * 100)))
</script>
