<template>
  <NuxtLink
    :to="'/trash/' + region.id"
    class="block bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/40 cursor-pointer transition-all duration-300"
  >
    <!-- Header: Region name + emission place -->
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <span class="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">location_on</span>
      </div>
      <div>
        <h3 class="font-bold text-slate-900 dark:text-white">{{ region.targetRegion }}</h3>
        <p v-if="region.emissionPlace || region.emissionPlaceType" class="text-xs text-slate-500 dark:text-slate-400">
          {{ region.emissionPlace }}
          <span v-if="region.emissionPlace && region.emissionPlaceType"> · </span>
          {{ region.emissionPlaceType }}
        </p>
      </div>
    </div>

    <!-- Waste type badge chips -->
    <div v-if="region.wasteTypes.length > 0" class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-for="wt in region.wasteTypes"
        :key="wt.type"
        :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badgeClass(wt.type)]"
      >
        {{ wt.type }}
      </span>
    </div>

    <!-- Day-of-week summary per waste type -->
    <div class="text-sm text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
      <div v-for="wt in region.wasteTypes" :key="wt.type + '-day'" class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px] text-slate-400 shrink-0">calendar_month</span>
        <span class="font-medium text-slate-700 dark:text-slate-200 min-w-[5em]">{{ wt.type }}</span>
        <span v-if="wt.dayOfWeek.length > 0" class="text-slate-500 dark:text-slate-400">{{ wt.dayOfWeek.join(', ') }}</span>
        <span v-else class="text-slate-400 dark:text-slate-500">예약제</span>
      </div>
    </div>

    <!-- Uncollected day warning -->
    <div v-if="region.uncollectedDay" class="flex items-start gap-2 mt-3 pl-1">
      <span class="material-symbols-outlined text-[16px] text-red-400 shrink-0 mt-0.5">warning</span>
      <p class="text-sm text-red-500 dark:text-red-400">
        <span class="font-medium">미수거일:</span>
        <span class="ml-1">{{ region.uncollectedDay }}</span>
      </p>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { RegionSchedule, WasteType } from '~/composables/useWasteSchedule'

defineProps<{
  region: RegionSchedule
}>()

const badgeClass = (type: WasteType): string => {
  const map: Record<WasteType, string> = {
    '일반쓰레기': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    '음식물쓰레기': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    '재활용': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    '대형폐기물': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  }
  return map[type] || ''
}
</script>
