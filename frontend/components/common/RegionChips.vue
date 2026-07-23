<template>
  <nav class="flex flex-wrap items-center gap-2" aria-label="지역 선택">
    <span v-if="label" class="text-xs text-slate-500 font-medium pr-1">{{ label }}</span>
    <NuxtLink
      v-if="activeSlug"
      :to="hrefFor('')"
      class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
    >전체</NuxtLink>
    <NuxtLink
      v-for="c in chips"
      :key="c.slug"
      :to="hrefFor(c.slug)"
      :aria-current="c.slug === activeSlug ? 'page' : undefined"
      class="px-3 py-1.5 border rounded-full text-sm transition-all"
      :class="c.slug === activeSlug
        ? 'bg-primary/5 border-primary text-primary font-medium'
        : 'bg-white border-line text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary'"
    >{{ c.label }}</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { SIDO_CHIPS } from '~/utils/regionChips'

withDefaults(
  defineProps<{
    hrefFor: (slug: string) => string
    activeSlug?: string
    label?: string
  }>(),
  { activeSlug: '', label: '지역별 보기' },
)

const chips = SIDO_CHIPS
</script>
