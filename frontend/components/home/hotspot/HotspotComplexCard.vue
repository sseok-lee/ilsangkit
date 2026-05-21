<template>
  <div class="bg-white p-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-[18px]" :class="iconColor">{{ icon }}</span>
      <h3 class="text-sm font-bold text-slate-900">{{ title }}</h3>
    </div>
    <ul class="space-y-1">
      <li v-for="(row, i) in rows" :key="row.buildingName + row.districtSlug + i">
        <HotspotComplexRow
          :row="row"
          :property-type="propertyType"
          :metric1-value="formatMetric1(row)"
          :metric2-label="formatMetric2(row)"
          :metric2-class="metric2Class"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HotspotComplexRow from './HotspotComplexRow.vue';
import type { NewHighRow, ActiveRow, TopPyeongRow } from '~/composables/useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

type Variant = 'newHigh' | 'active' | 'topPyeong';
type AnyRow = NewHighRow | ActiveRow | TopPyeongRow;

const props = defineProps<{
  variant: Variant;
  rows: AnyRow[];
  propertyType: RealEstatePropertyType;
}>();

const VARIANT_META: Record<Variant, { title: string; icon: string; iconColor: string; metric2Class?: string }> = {
  newHigh:   { title: '신고가 갱신', icon: 'trending_up',           iconColor: 'text-red-500',    metric2Class: 'text-red-500' },
  active:    { title: '거래 활발',   icon: 'local_fire_department', iconColor: 'text-orange-500' },
  topPyeong: { title: '평당가 TOP',  icon: 'diamond',               iconColor: 'text-violet-500' },
};

const title = computed(() => VARIANT_META[props.variant].title);
const icon = computed(() => VARIANT_META[props.variant].icon);
const iconColor = computed(() => VARIANT_META[props.variant].iconColor);
const metric2Class = computed(() => VARIANT_META[props.variant].metric2Class);

function nf(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n));
}

function formatMetric1(row: AnyRow): string {
  if (props.variant === 'newHigh') return `${nf((row as NewHighRow).newPyeong)}만원`;
  if (props.variant === 'active')  return `${(row as ActiveRow).txnCount}건`;
  return `${nf((row as TopPyeongRow).avgPyeongPrice)}만원`;
}

function formatMetric2(row: AnyRow): string {
  if (props.variant === 'newHigh') {
    const c = (row as NewHighRow).changePct;
    return `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
  }
  if (props.variant === 'active') return `${nf((row as ActiveRow).avgPyeongPrice)}만원`;
  return `${(row as TopPyeongRow).txnCount}건`;
}
</script>
