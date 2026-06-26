<template>
  <div v-if="stations.length || alternatives.length" class="flex flex-col gap-3">
    <div
      v-if="nearestStation"
      class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5 text-sm"
    >
      <span class="text-xs font-bold text-primary">{{ nearestStation.line }}</span>
      <span class="text-slate-700">{{ nearestStation.name }}역 · <b>{{ walkText(nearestStation.distance) }}</b></span>
    </div>

    <div v-if="alternatives.length">
      <p class="text-xs font-bold text-gray-500 mb-1">{{ alternativeLabel }}</p>
      <NuxtLink
        v-for="alt in alternatives"
        :key="alt.id"
        :to="`/${alt.category}/${alt.id}`"
        class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm"
      >
        <span class="text-slate-900 font-medium truncate">{{ alt.name }}</span>
        <span v-if="alt.distance != null" class="text-gray-400 shrink-0 ml-2">{{ distText(alt.distance) }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NearbyStation } from '~/composables/useTransitNearby'

const props = withDefaults(defineProps<{
  stations: NearbyStation[]
  alternatives: Array<{ id: string; category: string; name: string; roadAddress?: string | null; address?: string | null; distance?: number }>
  alternativeLabel?: string
}>(), { alternativeLabel: '가까운 다른 시설' })

const nearestStation = computed(() => props.stations[0] ?? null)

function distText(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}
function walkText(m: number): string {
  if (m < 800) return `도보 ${Math.max(1, Math.round(m / 67))}분 (${distText(m)})`
  return distText(m)
}
</script>
