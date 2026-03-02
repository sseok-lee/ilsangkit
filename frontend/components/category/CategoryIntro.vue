<template>
  <section class="mb-6">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
      {{ categoryLabel }} 안내
    </h2>
    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      {{ description }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_DESCRIPTIONS } from '~/utils/categoryDescriptions'

const props = defineProps<{
  category: FacilityCategory
}>()

const categoryLabel = computed(() => CATEGORY_META[props.category]?.label ?? props.category)
const description = computed(() => CATEGORY_DESCRIPTIONS[props.category] ?? '')
</script>
