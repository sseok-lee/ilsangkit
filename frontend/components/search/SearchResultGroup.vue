<template>
  <div class="mb-6 last:mb-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          v-if="iconImg"
          class="w-[30px] h-[30px] rounded-lg bg-slate-50 flex items-center justify-center shrink-0"
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
        class="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-bold text-primary px-2 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
      >
        더보기
        <span class="material-symbols-outlined text-[15px]" aria-hidden="true">chevron_right</span>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-bold text-primary px-2 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
        @click="emit('more')"
      >
        더보기
        <span class="material-symbols-outlined text-[15px]" aria-hidden="true">chevron_right</span>
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import CategoryIcon from '~/components/common/CategoryIcon.vue'

withDefaults(defineProps<{
  label: string
  count: number
  moreHref?: string
  countUnit?: string
  iconImg?: string
  catColor?: string
  catCategory?: string
}>(), { countUnit: '곳' })

const emit = defineEmits<{ more: [] }>()
</script>
