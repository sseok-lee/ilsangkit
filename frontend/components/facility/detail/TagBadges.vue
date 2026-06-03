<template>
  <div class="flex flex-wrap" :class="gapClass">
    <span
      v-for="(item, i) in items"
      :key="`${item.label}-${i}`"
      :class="[chipBaseClass, paddingClass, item.colorClass ?? variantClass]"
    >
      {{ item.label }}<span v-if="item.suffix" :class="suffixClass">{{ item.suffix }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface TagBadgeItem { label: string; suffix?: string; colorClass?: string }

const props = withDefaults(defineProps<{
  items: TagBadgeItem[]
  variant?: 'teal' | 'gray' | 'sky' | 'custom'
}>(), { variant: 'gray' })

// hospital: inline-flex items-center rounded-full ... text-xs font-medium
// market:   inline-block               rounded-full ... text-xs  (no font-medium, no flex)
// school:   inline-flex items-center rounded-full ... text-xs font-medium
// childcare:inline-flex items-center gap-1 rounded-full ... text-xs font-medium  (gap-1 inside chip)
const chipBaseClass = computed(() => {
  if (props.variant === 'gray') return 'inline-block rounded-full text-xs'
  if (props.variant === 'custom') return 'inline-flex items-center gap-1 rounded-full text-xs font-medium'
  return 'inline-flex items-center rounded-full text-xs font-medium'
})

const variantClass = computed(() => ({
  teal: 'bg-teal-50 text-teal-700 border border-teal-200',
  gray: 'bg-gray-100 text-gray-700',
  sky: 'bg-sky-100 text-sky-800',
  custom: '',
}[props.variant]))

// hospital: px-2.5 py-0.5   market: px-2.5 py-0.5   school: px-3 py-1   childcare: px-2.5 py-1
const paddingClass = computed(() => {
  if (props.variant === 'sky') return 'px-3 py-1'
  if (props.variant === 'custom') return 'px-2.5 py-1'
  // teal (hospital) and gray (market)
  return 'px-2.5 py-0.5'
})

// gap: hospital=gap-1.5  market=gap-1  school=gap-2  childcare=gap-2
const gapClass = computed(() => ({
  teal: 'gap-1.5',
  gray: 'gap-1',
  sky: 'gap-2',
  custom: 'gap-2',
}[props.variant]))

// suffix: hospital → ml-1 text-teal-500  childcare → font-semibold (inside gap-1 flex)
const suffixClass = computed(() => {
  if (props.variant === 'teal') return 'ml-1 text-teal-500'
  return 'font-semibold'
})
</script>
