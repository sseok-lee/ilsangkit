<template>
  <nav class="flex flex-wrap items-center gap-2" aria-label="지역 선택">
    <span v-if="label" class="w-full text-[13px] font-semibold text-muted">{{ label }}</span>
    <UiChip v-if="activeSlug" :to="hrefFor('')">전체</UiChip>
    <UiChip
      v-for="c in chips"
      :key="c.slug"
      :to="hrefFor(c.slug)"
      :selected="c.slug === activeSlug"
    >{{ c.label }}</UiChip>
  </nav>
</template>

<script setup lang="ts">
import UiChip from '~/components/common/UiChip.vue'
import { SIDO_CHIPS } from '~/utils/regionChips'

withDefaults(
  defineProps<{
    hrefFor: (slug: string) => string
    activeSlug?: string
    label?: string
    variant?: 'flat'
  }>(),
  { activeSlug: '', label: '지역별 보기', variant: 'flat' },
)

const chips = SIDO_CHIPS
</script>
