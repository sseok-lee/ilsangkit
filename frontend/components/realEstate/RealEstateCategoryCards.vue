<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <NuxtLink
      v-for="pt in PROPERTY_TYPES"
      :key="pt"
      :to="`/real-estate/${pt}`"
      class="group flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div
        class="flex size-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors"
      >
        <span class="material-symbols-outlined text-[24px] text-primary">
          {{ PROPERTY_TYPE_META[pt].icon }}
        </span>
      </div>
      <div class="text-center">
        <p class="text-[15px] font-semibold text-slate-800 group-hover:text-primary transition-colors">
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
import { PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
</script>
