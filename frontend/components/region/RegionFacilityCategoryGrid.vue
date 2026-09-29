<template>
  <section id="facilities" class="mb-6 rounded-xl border border-line bg-white p-4 md:p-5">
    <div class="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
      <h2 class="text-display-2 text-slate-900 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-[22px]">location_city</span>
        생활시설현황
      </h2>
      <p class="text-sm text-slate-500">총 {{ total.toLocaleString() }}개 시설</p>
    </div>
    <div class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white md:grid md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-3">
      <NuxtLink
        v-for="(count, cat) in categories"
        :key="cat"
        :to="`/${city}/${district}/${cat}`"
        :class="[
          'group flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
          topCategories.includes(String(cat))
            ? 'bg-primary/5'
            : 'bg-white',
        ]"
      >
        <img :src="`/icons/category/${cat}.webp?v2`" :alt="CATEGORY_META[cat as FacilityCategory]?.label" class="size-8 shrink-0" width="32" height="32" loading="lazy" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-slate-900">{{ CATEGORY_META[cat as FacilityCategory]?.label }}</span>
          <span class="mt-0.5 block text-xs text-slate-500">{{ count.toLocaleString() }}개</span>
        </span>
        <span class="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-primary">chevron_right</span>
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
