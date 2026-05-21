<template>
  <NuxtLink :to="href" class="flex items-center justify-between gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition">
    <div class="min-w-0">
      <div class="text-sm font-bold text-slate-900 truncate">{{ row.buildingName }}</div>
      <div class="text-[11px] text-slate-500 truncate">{{ row.district }}</div>
    </div>
    <div class="text-right whitespace-nowrap">
      <div class="text-sm font-bold text-slate-900">{{ metric1Value }}</div>
      <div :class="['text-[11px] font-bold', metric2Class ?? 'text-slate-500']">{{ metric2Label }}</div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComplexRef } from '~/composables/useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

const props = defineProps<{
  row: ComplexRef;
  propertyType: RealEstatePropertyType;
  metric1Value: string;
  metric2Label: string;
  metric2Class?: string;
}>();

const href = computed(() => {
  return `/real-estate/${props.propertyType}/${props.row.citySlug}/${props.row.districtSlug}/${encodeURIComponent(props.row.buildingName)}`;
});
</script>
