<template>
  <section id="facilities" class="mb-6">
    <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-primary text-[22px]">location_city</span>
      생활시설 현황
    </h2>
    <p class="text-sm text-slate-500 mb-3">총 {{ total.toLocaleString() }}개 시설</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <NuxtLink
        v-for="(count, cat) in categories"
        :key="cat"
        :to="`/${city}/${district}/${cat}`"
        :class="[
          'group flex flex-col items-center p-4 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
          topCategories.includes(String(cat))
            ? 'border-primary/30 bg-primary/5'
            : 'border-slate-200 bg-white hover:bg-slate-50',
        ]"
      >
        <img :src="`/icons/category/${cat}.webp?v2`" :alt="CATEGORY_META[cat as FacilityCategory]?.label" class="w-8 h-8 mb-2" width="32" height="32" loading="lazy" />
        <span class="text-xs text-slate-600 mb-1">{{ CATEGORY_META[cat as FacilityCategory]?.label }}</span>
        <span class="text-sm font-bold text-slate-800">{{ count }}개</span>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

defineProps<{
  city: string
  district: string
  total: number
  categories: Record<string, number>
  topCategories: string[]
}>()
</script>
