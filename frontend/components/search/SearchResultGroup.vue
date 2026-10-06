<template>
  <div class="mb-6 last:mb-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          v-if="iconImg"
          class="w-[30px] h-[30px] rounded-lg bg-background-light flex items-center justify-center shrink-0"
        >
          <img :src="`/icons/category/${iconImg}.webp?v2`" :alt="label" class="w-[19px] h-[19px]" width="19" height="19" />
        </span>
        <span
          v-else
          class="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
          :style="catColor ? { backgroundColor: `color-mix(in srgb, ${catColor} 12%, white)`, color: catColor } : undefined"
        >
          <CategoryIcon v-if="catCategory" :category-id="catCategory" size="sm" />
        </span>
        <span class="text-base font-bold text-strong tracking-tight truncate">{{ label }}</span>
        <span class="text-[13px] font-semibold text-faint tabular-nums shrink-0">{{ count.toLocaleString('ko-KR') }}{{ countUnit }}</span>
      </div>
      <NuxtLink
        v-if="moreHref"
        :to="moreHref"
        class="search-result-group__more"
      >
        {{ moreLabel }}
        <span class="material-symbols-outlined text-[15px]" aria-hidden="true">chevron_right</span>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="search-result-group__more"
        @click="emit('more')"
      >
        {{ moreLabel }}
        <span class="material-symbols-outlined text-[15px]" aria-hidden="true">chevron_right</span>
      </button>
    </div>
    <div
      :data-layout="layout"
      :class="layout === 'rows'
        ? 'search-result-group__items--rows'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import CategoryIcon from '~/components/common/CategoryIcon.vue'

withDefaults(defineProps<{
  label: string
  count: number
  moreHref?: RouteLocationRaw
  countUnit?: string
  iconImg?: string
  catColor?: string
  catCategory?: string
  layout?: 'cards' | 'rows'
  moreLabel?: string
}>(), {
  countUnit: '곳',
  layout: 'cards',
  moreLabel: '더보기',
})

const emit = defineEmits<{ more: [] }>()
</script>

<style scoped>
.search-result-group__more {
  display: inline-flex;
  min-height: 44px;
  flex-shrink: 0;
  align-items: center;
  gap: 0.125rem;
  border-radius: 0.5rem;
  padding: 0.5rem;
  color: #2450dc;
  font-size: 0.8125rem;
  font-weight: 700;
}

.search-result-group__more:hover {
  background: #eef2ff;
}

.search-result-group__items--rows {
  overflow: hidden;
  border-top: 1px solid #e6e9f0;
  background: #fff;
}
</style>
