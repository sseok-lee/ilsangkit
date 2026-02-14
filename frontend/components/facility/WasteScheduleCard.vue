<template>
  <NuxtLink
    :to="'/trash/' + region.id"
    :aria-label="`${region.targetRegion} 쓰레기 배출 일정 상세보기`"
    class="group bg-white dark:bg-slate-800 rounded-xl p-4 shadow-subtle hover:shadow-lg dark:shadow-none transition-all duration-300 border cursor-pointer border-transparent hover:border-primary/20 dark:hover:border-primary/40"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div class="shrink-0 w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <CategoryIcon category-id="trash" size="md" />
      </div>

      <!-- Details -->
      <div class="flex-1 min-w-0 pt-0.5">
        <!-- Title -->
        <h3 class="text-slate-900 dark:text-white text-base font-bold truncate">
          {{ region.targetRegion }}
        </h3>

        <!-- Subtitle: emission place + type -->
        <p v-if="region.emissionPlace || region.emissionPlaceType" class="text-slate-500 dark:text-slate-400 text-xs font-normal mt-1 truncate">
          {{ region.emissionPlace }}
          <span v-if="region.emissionPlace && region.emissionPlaceType"> · </span>
          {{ region.emissionPlaceType }}
        </p>

        <!-- Waste type badges + uncollected warning -->
        <div class="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span
            v-for="wt in region.wasteTypes"
            :key="wt.type"
            :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badgeClass(wt.type)]"
          >
            {{ wt.type }}
          </span>
          <span
            v-if="region.uncollectedDay"
            class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >
            <span class="material-symbols-outlined text-[14px]">warning</span>
            미수거
          </span>
        </div>
      </div>
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
