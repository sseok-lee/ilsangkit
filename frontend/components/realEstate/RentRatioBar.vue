<template>
  <div v-if="total > 0" data-testid="rent-ratio">
    <div
      class="flex h-6 w-full overflow-hidden rounded-lg text-xs font-bold"
      role="img"
      :aria-label="ariaLabel"
    >
      <div class="flex items-center justify-center bg-primary text-white" :style="{ width: jeonsePct + '%' }">
        <span v-if="jeonsePct > 0">전세 {{ jeonsePct }}%</span>
      </div>
      <div class="flex items-center justify-center bg-primary-100 text-primary-700" :style="{ width: (100 - jeonsePct) + '%' }">
        <span v-if="100 - jeonsePct > 0">월세 {{ 100 - jeonsePct }}%</span>
      </div>
    </div>
    <p class="mt-1 text-xs text-slate-500">전체 거래 기준 전세 {{ jeonseCount }}건 · 월세 {{ wolseCount }}건</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getJeonsePct } from '~/utils/realEstateDetailLabels'

const props = withDefaults(defineProps<{ jeonseCount?: number; wolseCount?: number }>(), {
  jeonseCount: 0,
  wolseCount: 0,
})

const total = computed(() => props.jeonseCount + props.wolseCount)
const jeonsePct = computed(() => getJeonsePct(props.jeonseCount, props.wolseCount))
const ariaLabel = computed(() =>
  `전세 ${jeonsePct.value}%, 월세 ${100 - jeonsePct.value}% (전세 ${props.jeonseCount}건, 월세 ${props.wolseCount}건)`,
)
</script>
