<template>
  <SectionBlock id="facilities" variant="flat" heading="생활시설현황">
    <template #right>
      <p class="text-sm text-muted tabular-nums">총 {{ total.toLocaleString() }}개 시설</p>
    </template>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-x-8 border-t border-line">
      <NuxtLink
        v-for="(count, cat) in categories"
        :key="cat"
        :to="`/${city}/${district}/${cat}`"
        class="group flex min-h-[72px] items-center gap-3 py-3 pl-1 pr-1 border-b border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <img :src="`/icons/category/${cat}.webp?v2`" :alt="CATEGORY_META[cat as FacilityCategory]?.label" class="size-8 shrink-0" width="32" height="32" loading="lazy" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-ink group-hover:text-primary">
            {{ CATEGORY_META[cat as FacilityCategory]?.label }} <span
              v-if="topCategories.includes(String(cat))"
              data-test="top-mark"
              class="ml-1.5 text-[12px] font-semibold text-primary"
            >많은 시설</span>
          </span>
          <span class="mt-0.5 block text-[13px] text-muted tabular-nums">{{ count.toLocaleString() }}개</span>
        </span>
        <span class="material-symbols-outlined text-[18px] text-faint group-hover:text-primary" aria-hidden="true">chevron_right</span>
      </NuxtLink>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import SectionBlock from '~/components/common/SectionBlock.vue'

defineProps<{
  city: string
  district: string
  total: number
  categories: Record<string, number>
  topCategories: string[]
}>()
</script>
