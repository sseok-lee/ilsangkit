<template>
  <div v-if="recovery" class="text-left max-w-md mx-auto">
    <p v-if="recovery.scope === 'region' && recovery.regionLabel" class="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
      <span class="material-symbols-outlined text-[16px] text-primary">my_location</span>
      {{ recovery.regionLabel }}에서 이런 건 어때요?
    </p>
    <p v-else class="text-xs font-bold text-slate-500 mb-2">이런 건 어때요?</p>
    <div class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="chip in recovery.chips"
        :key="chip.label + chip.category"
        :to="chipTo(chip)"
        class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/5 text-primary border border-primary/20 rounded-full text-xs font-medium hover:bg-primary hover:text-white transition-colors"
      >{{ chip.label }}</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CITY_FULL_NAME_TO_SLUG, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import type { Recovery, RecoveryChip } from '~/composables/useFacilitySearch'

defineProps<{ recovery: Recovery | null }>()

function chipTo(chip: RecoveryChip): string {
  if (chip.city && chip.district) {
    const c = CITY_FULL_NAME_TO_SLUG[chip.city]
    const d = DISTRICT_SLUG_MAP[chip.district]
    if (c && d) return `/${c}/${d}/${chip.category}`
  }
  return `/${chip.category}`
}
</script>
