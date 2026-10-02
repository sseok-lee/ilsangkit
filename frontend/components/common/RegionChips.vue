<template>
  <nav class="flex flex-wrap items-center gap-2" aria-label="지역 선택">
    <template v-if="variant === 'flat'">
      <span v-if="label" class="w-full text-[13px] font-semibold text-muted">{{ label }}</span>
      <UiChip v-if="activeSlug" :to="hrefFor('')">전체</UiChip>
      <UiChip
        v-for="c in chips"
        :key="c.slug"
        :to="hrefFor(c.slug)"
        :selected="c.slug === activeSlug"
      >{{ c.label }}</UiChip>
    </template>
    <template v-else>
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
    </template>
  </nav>
</template>

<script setup lang="ts">
import UiChip from '~/components/common/UiChip.vue'
import { SIDO_CHIPS } from '~/utils/regionChips'

// variant 기본 card — 아직 평면형으로 옮기지 않은 페이지의 화면을 지킨다. PR7 에서 flat 으로 바꾼다.
withDefaults(
  defineProps<{
    hrefFor: (slug: string) => string
    activeSlug?: string
    label?: string
    variant?: 'card' | 'flat'
  }>(),
  { activeSlug: '', label: '지역별 보기', variant: 'card' },
)

const chips = SIDO_CHIPS
</script>
