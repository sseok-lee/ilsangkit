<template>
  <section class="mb-6">
    <h2 class="text-lg font-bold text-slate-900 mb-2">
      {{ categoryLabel }} 안내
    </h2>
    <p class="text-sm text-slate-600 leading-relaxed mb-3">
      {{ description }}
    </p>
    <div v-if="tips.length > 0" class="bg-slate-50 rounded-lg p-4 border border-slate-100">
      <h3 class="text-sm font-semibold text-slate-800 mb-2">이용 팁</h3>
      <ul class="space-y-1.5">
        <li v-for="(tip, idx) in tips" :key="idx" class="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
          <span class="text-primary mt-0.5 shrink-0">&#8226;</span>
          <span>{{ tip }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_DESCRIPTIONS, CATEGORY_TIPS } from '~/utils/categoryDescriptions'

const props = defineProps<{
  category: FacilityCategory
}>()

const categoryLabel = computed(() => CATEGORY_META[props.category]?.label ?? props.category)
const description = computed(() => CATEGORY_DESCRIPTIONS[props.category] ?? '')
const tips = computed(() => CATEGORY_TIPS[props.category] ?? [])
</script>
