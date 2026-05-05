<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <NuxtLink
      v-for="pt in VISIBLE_PROPERTY_TYPES"
      :key="pt"
      :to="`/real-estate/${pt}-sale`"
      class="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div
        class="flex size-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors"
      >
        <img :src="`/icons/category/${PROPERTY_TYPE_META[pt].iconImg}.webp?v2`" :alt="PROPERTY_TYPE_META[pt].label" class="w-8 h-8" width="32" height="32" />
      </div>
      <div class="text-center">
        <p class="text-base font-semibold text-slate-800 group-hover:text-primary transition-colors">
          {{ PROPERTY_TYPE_META[pt].label }}
        </p>
        <p class="mt-0.5 text-xs text-primary/60 font-medium">매매 · 전월세</p>
        <p class="mt-1 text-xs text-slate-500 line-clamp-2">
          {{ PROPERTY_TYPE_META[pt].description }}
        </p>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { VISIBLE_PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
</script>
