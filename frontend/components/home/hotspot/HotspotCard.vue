<template>
  <div class="bg-white p-5">
    <div class="flex items-center gap-2 mb-4">
      <span :class="['w-7 h-7 rounded-full inline-flex items-center justify-center', iconBg]">
        <span :class="['material-symbols-outlined text-[18px]', iconColor]">{{ iconName }}</span>
      </span>
      <strong class="text-sm font-bold text-slate-900">{{ title }}</strong>
      <span class="ml-auto text-[11px] text-slate-400">{{ caption }}</span>
    </div>
    <p v-if="isWolse && signal === 'active'" class="text-[11px] text-slate-500 mb-3">
      월세는 거래량 시그널만 제공해요
    </p>
    <ol v-if="regions.length > 0" class="divide-y divide-slate-100">
      <HotspotRow
        v-for="(region, idx) in regions"
        :key="`${region.citySlug}-${region.districtSlug}`"
        :region="region"
        :rank="idx + 1"
        :signal="signal"
        :href="buildHref(region)"
      />
    </ol>
    <p v-else class="text-sm text-slate-500 py-4 text-center">이번 주는 유의미한 변동이 없어요</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HotspotRow from './HotspotRow.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';
import { toApiSlug } from '~/types/realEstate';
import type { RealEstatePropertyType } from '~/types/realEstate';

type Signal = 'rising' | 'falling' | 'active';
type TxnKey = 'sale' | 'jeonse' | 'wolse';

const props = defineProps<{
  signal: Signal;
  regions: HotspotRegion[];
  propertyType: RealEstatePropertyType;
  txnType: TxnKey;
}>();

const SIGNAL_META: Record<Signal, { title: string; icon: string; iconBg: string; iconColor: string; caption: string }> = {
  rising:  { title: '평당가 상승 TOP', icon: 'local_fire_department', iconBg: 'bg-red-50', iconColor: 'text-red-500', caption: 'vs 전주' },
  falling: { title: '평당가 하락 TOP', icon: 'trending_down', iconBg: 'bg-primary-50', iconColor: 'text-primary-500', caption: 'vs 전주' },
  active:  { title: '거래 급증 지역', icon: 'bolt', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', caption: '거래량 변동' },
};

const title = computed(() => SIGNAL_META[props.signal].title);
const iconName = computed(() => SIGNAL_META[props.signal].icon);
const iconBg = computed(() => SIGNAL_META[props.signal].iconBg);
const iconColor = computed(() => SIGNAL_META[props.signal].iconColor);
const caption = computed(() => SIGNAL_META[props.signal].caption);
const isWolse = computed(() => props.txnType === 'wolse');

// 부동산 지역 허브 페이지(/real-estate/{slug}/{city}/{district})로 직접 이동.
// 전세/월세 구분은 페이지 내부 토글에서 처리하되 query param으로 힌트 전달.
function buildHref(region: HotspotRegion): string {
  const mode: 'sale' | 'rent' = props.txnType === 'sale' ? 'sale' : 'rent';
  const slug = toApiSlug(props.propertyType, mode);
  const base = `/real-estate/${slug}/${region.citySlug}/${region.districtSlug}`;
  if (props.txnType === 'jeonse') return `${base}?rentType=${encodeURIComponent('전세')}`;
  if (props.txnType === 'wolse') return `${base}?rentType=${encodeURIComponent('월세')}`;
  return base;
}
</script>
