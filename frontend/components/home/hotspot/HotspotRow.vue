<template>
  <HardLink :to="href" :class="rowClass">
    <span class="w-5 text-[12px] font-display font-extrabold text-faint tabular-nums">{{ rank }}</span>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-bold text-strong truncate">{{ cityShort }} {{ region.district }}</div>
      <div class="text-[11px] text-muted tabular-nums">
        <template v-if="region.pricePerPyeong !== null">평당 {{ formatPyeong(region.pricePerPyeong) }} · </template>
        {{ region.txnCount.toLocaleString('ko-KR') }}건
      </div>
    </div>
    <span :class="['text-sm font-display font-bold tabular-nums', changeColorClass]">{{ changeLabel }}</span>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

type Signal = 'rising' | 'falling' | 'active';

const props = defineProps<{
  region: HotspotRegion;
  rank: number;
  signal: Signal;
  href: string;
}>();

const SIGNAL_HOVER: Record<Signal, string> = {
  rising:  'hover:bg-red-50/40',
  falling: 'hover:bg-primary-50/40',
  active:  'hover:bg-violet-50/40',
};

const SIGNAL_COLOR: Record<Signal, string> = {
  rising:  'text-red-500',
  falling: 'text-primary-500',
  active:  'text-violet-600',
};

const rowClass = computed(() =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${SIGNAL_HOVER[props.signal]}`,
);

const changeColorClass = computed(() => SIGNAL_COLOR[props.signal]);

const cityShort = computed(() => props.region.city.replace(/특별시|광역시|특별자치시|특별자치도|도$/u, ''));

const changeLabel = computed(() => {
  const value = props.signal === 'active' ? props.region.volumeChangePct : props.region.changePct;
  if (value === null) return '—';
  const sign = value > 0 ? '+' : (value < 0 ? '−' : '');
  const abs = Math.abs(value);
  return `${sign}${abs.toFixed(1)}%`;
});

function formatPyeong(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}만`;
}
</script>
