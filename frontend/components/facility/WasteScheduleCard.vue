<template>
  <button
    type="button"
    :aria-label="`${region.targetRegion?.replaceAll('+', ', ')} 쓰레기 배출 일정 상세 정보 보기`"
    class="group w-full bg-white rounded-xl p-4 text-left shadow-subtle hover:shadow-lg transition-all duration-300 border cursor-pointer border-transparent hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    @click="emit('select', region)"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div class="shrink-0 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        <CategoryIcon category-id="trash" size="md" />
      </div>

      <!-- Details -->
      <div class="flex-1 min-w-0 pt-0.5">
        <!-- City badge -->
        <p v-if="region.city" class="text-slate-500 text-[11px] font-medium tracking-wide truncate">
          {{ shortCity }}{{ region.district ? ` · ${region.district}` : '' }}
        </p>

        <!-- Title -->
        <h3 class="text-slate-900 text-base font-bold truncate">
          {{ region.targetRegion?.replaceAll('+', ', ') }}
        </h3>

        <!-- Subtitle: emission place + type -->
        <p v-if="region.emissionPlace || region.emissionPlaceType" class="text-slate-500 text-xs font-normal mt-1 truncate">
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
            class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
          >
            <span class="material-symbols-outlined text-[14px]">warning</span>
            미수거
          </span>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RegionSchedule, WasteType } from '~/composables/useWasteSchedule'

const props = defineProps<{
  region: RegionSchedule
}>()

const emit = defineEmits<{
  (e: 'select', region: RegionSchedule): void
}>()

const shortCity = computed(() =>
  props.region.city?.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '') || ''
)

const badgeClass = (type: WasteType): string => {
  const map: Record<WasteType, string> = {
    '일반쓰레기': 'bg-amber-100 text-amber-700',
    '음식물쓰레기': 'bg-green-100 text-green-700',
    '재활용': 'bg-teal-100 text-teal-700',
    '대형폐기물': 'bg-purple-100 text-purple-700',
  }
  return map[type] || ''
}
</script>
