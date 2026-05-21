<template>
  <section
    v-if="hasSeedData"
    class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6"
  >
    <div class="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
      <div class="px-6 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
            오늘의 부동산 시장
          </h2>
          <p class="text-sm text-slate-500 mt-1">신고가 갱신 · 거래 활발 · 평당가 TOP 단지 (매매)</p>
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
              'px-4 py-1.5 rounded-full transition inline-flex items-center gap-1.5',
              propertyType === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ]"
            @click="onPropertyChange(opt.value)"
          >
            <span
              v-if="isLoadingProperty && propertyType === opt.value"
              class="inline-block w-3 h-3 border-2 border-slate-300 border-t-primary rounded-full animate-spin"
              aria-label="불러오는 중"
            />
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="grid gap-px bg-slate-100 border-t border-slate-100 grid-cols-1 md:grid-cols-3">
        <HotspotComplexCard variant="newHigh"   :rows="currentData.newHigh"   :property-type="propertyType" />
        <HotspotComplexCard variant="active"    :rows="currentData.active"    :property-type="propertyType" />
        <HotspotComplexCard variant="topPyeong" :rows="currentData.topPyeong" :property-type="propertyType" />
      </div>

      <div class="px-6 py-3 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
        <span class="material-symbols-outlined text-[14px] text-slate-400">info</span>
        국토교통부 실거래가 · 최근 30일 (신고가 카드는 직전 12개월 기준 갱신)
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import HotspotComplexCard from './hotspot/HotspotComplexCard.vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';
import { useComplexHotspots } from '~/composables/useComplexHotspots';
import type { RealEstatePropertyType } from '~/types/realEstate';

const props = defineProps<{ hotspots: ComplexHotspotsByProperty }>();

const PROPERTY_OPTIONS: { value: RealEstatePropertyType; label: string }[] = [
  { value: 'apt', label: '아파트' },
  { value: 'offitel', label: '오피스텔' },
  { value: 'villa', label: '빌라' },
];

const propertyType = ref<RealEstatePropertyType>('apt');
const isLoadingProperty = ref(false);

const { data, loadProperty } = useComplexHotspots(props.hotspots);

const hasSeedData = computed(() => Object.keys(data.value).length > 0);

const EMPTY: ComplexHotspots = { newHigh: [], active: [], topPyeong: [] };
const currentData = computed<ComplexHotspots>(() => data.value[propertyType.value] ?? EMPTY);

async function onPropertyChange(next: RealEstatePropertyType): Promise<void> {
  propertyType.value = next;
  if (data.value[next]) return;
  isLoadingProperty.value = true;
  try {
    await loadProperty(next);
  } catch {
    // silent fail
  } finally {
    isLoadingProperty.value = false;
  }
}
</script>
