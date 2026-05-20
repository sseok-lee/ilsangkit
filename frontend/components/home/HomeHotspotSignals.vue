<template>
  <section
    v-if="currentBundle"
    class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6"
  >
    <div class="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
      <div class="px-6 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
            오늘의 부동산 시장
          </h2>
          <p class="text-sm text-slate-500 mt-1">최근 7일 실거래 · 전주 대비 변동이 가장 큰 지역</p>
        </div>
        <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">
          전체 보기 →
        </HardLink>
      </div>

      <div class="px-6 pb-4 flex items-center gap-3 flex-wrap">
        <div class="inline-flex bg-slate-100 rounded-full p-1 text-sm font-bold">
          <button
            v-for="opt in PROPERTY_OPTIONS"
            :key="opt.value"
            :class="[
              'px-4 py-1.5 rounded-full transition',
              propertyType === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ]"
            @click="onPropertyChange(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <TxnTypeMiniTabs v-model="txnType" />
        <span class="ml-auto text-[11px] text-slate-400">자치구 단위 · 표본 30건 이상</span>
      </div>

      <div v-if="txnType !== 'wolse'" class="px-6 pb-2 lg:hidden">
        <div class="flex gap-1 text-[12px] font-bold border-b border-slate-100">
          <button
            v-for="opt in SIGNAL_OPTIONS"
            :key="opt.value"
            :class="[
              'px-2 py-2 border-b-2',
              mobileSignal === opt.value ? `${opt.borderClass} text-slate-900` : 'border-transparent text-slate-500',
            ]"
            @click="mobileSignal = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div :class="['grid gap-px bg-slate-100 border-t border-slate-100', cardGridCols]">
        <div
          v-if="txnType !== 'wolse'"
          :class="['lg:block', mobileSignal === 'rising' ? '' : 'hidden']"
        >
          <HotspotCard
            signal="rising"
            :regions="currentBundle.rising ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
        <div
          v-if="txnType !== 'wolse'"
          :class="['lg:block', mobileSignal === 'falling' ? '' : 'hidden']"
        >
          <HotspotCard
            signal="falling"
            :regions="currentBundle.falling ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
        <div :class="['lg:block', mobileSignal === 'active' || txnType === 'wolse' ? '' : 'hidden']">
          <HotspotCard
            signal="active"
            :regions="currentBundle.active ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
      </div>

      <div class="px-6 py-3 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
        <span class="material-symbols-outlined text-[14px] text-slate-400">info</span>
        국토교통부 실거래가 · 최근 7일 vs 직전 7일 · 표본 30건 미만 지역 제외
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import HotspotCard from './hotspot/HotspotCard.vue';
import TxnTypeMiniTabs from './hotspot/TxnTypeMiniTabs.vue';
import type { RealEstateHotspots } from '~/composables/useHomeDashboard';
import { useRealEstateHotspots } from '~/composables/useRealEstateHotspots';
import type { RealEstatePropertyType } from '~/types/realEstate';

type TxnKey = 'sale' | 'jeonse' | 'wolse';
type Signal = 'rising' | 'falling' | 'active';

const props = defineProps<{ hotspots: RealEstateHotspots }>();

const PROPERTY_OPTIONS: { value: RealEstatePropertyType; label: string }[] = [
  { value: 'apt', label: '아파트' },
  { value: 'offitel', label: '오피스텔' },
  { value: 'villa', label: '빌라' },
];

const SIGNAL_OPTIONS: { value: Signal; label: string; borderClass: string }[] = [
  { value: 'active',  label: '거래 급증', borderClass: 'border-violet-500' },
  { value: 'rising',  label: '상승',      borderClass: 'border-red-500' },
  { value: 'falling', label: '하락',      borderClass: 'border-blue-500' },
];

const propertyType = ref<RealEstatePropertyType>('apt');
const txnType = ref<TxnKey>('sale');
const mobileSignal = ref<Signal>('active');

const { data, loadProperty } = useRealEstateHotspots(props.hotspots);

async function onPropertyChange(next: RealEstatePropertyType): Promise<void> {
  propertyType.value = next;
  try {
    await loadProperty(next);
  } catch {
    // silent fail — previous data retained
  }
}

const currentBundle = computed(() => {
  const property = data.value[propertyType.value];
  if (!property) return null;
  return txnType.value === 'wolse'
    ? { rising: [], falling: [], active: property.wolse.active }
    : property[txnType.value];
});

const cardGridCols = computed(() => (txnType.value === 'wolse' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'));
</script>
