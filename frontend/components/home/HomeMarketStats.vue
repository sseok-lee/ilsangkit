<template>
  <section v-if="trends.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-display-2 text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
          오늘의 부동산 시장
        </h2>
        <p class="text-sm text-slate-500 mt-1">최근 7일 거래 평당가(전국) · 전주 대비 변동입니다.</p>
      </div>
      <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">전체보기 →</HardLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <div
        v-for="prop in PROPERTY_TYPES"
        :key="prop.id"
        class="bg-white border border-line rounded-2xl shadow-card overflow-hidden"
      >
        <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[22px]">{{ prop.icon }}</span>
          <strong class="font-bold text-slate-900">{{ prop.label }}</strong>
          <span class="ml-auto text-[11px] text-slate-400">최근 7일</span>
        </div>
        <ol class="divide-y divide-slate-100">
          <li v-for="row in TXN_ROWS" :key="row.id">
            <HardLink
              :to="`/real-estate/${prop.id}-${row.urlSuffix}`"
              class="flex items-center gap-3 px-5 py-3 hover:bg-primary/5 transition-colors"
            >
              <span class="w-10 text-[13px] font-bold text-slate-600">{{ row.label }}</span>
              <span class="flex-1 text-sm font-bold text-slate-900">
                {{ formatPricePerPyeong(findTrend(trends, prop.id, row.id)?.pricePerPyeong ?? null) }}
              </span>
              <span class="text-[11px] text-slate-500 w-16 text-right">
                {{ findTrend(trends, prop.id, row.id)?.txnCount?.toLocaleString('ko-KR') ?? '0' }}건
              </span>
              <span
                class="text-[11px] font-bold w-12 text-right"
                :class="changeColor(findTrend(trends, prop.id, row.id)?.changePct ?? null)"
              >
                {{ formatChange(findTrend(trends, prop.id, row.id)?.changePct ?? null) }}
              </span>
            </HardLink>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue';
import { formatPricePerPyeong, formatChange } from '~/utils/priceFormat';
import type { RealEstateTrend } from '~/composables/useHomeDashboard';

defineProps<{ trends: RealEstateTrend[] }>();

const PROPERTY_TYPES = [
  { id: 'apt', label: '아파트', icon: 'apartment' },
  { id: 'offitel', label: '오피스텔', icon: 'corporate_fare' },
  { id: 'villa', label: '빌라', icon: 'house' },
] as const;

const TXN_ROWS = [
  { id: 'sale', label: '매매', urlSuffix: 'sale' },
  { id: 'jeonse', label: '전세', urlSuffix: 'rent' },
  { id: 'wolse', label: '월세', urlSuffix: 'rent' },
] as const;

function findTrend(
  trends: RealEstateTrend[],
  propertyType: 'apt' | 'offitel' | 'villa',
  txnType: 'sale' | 'jeonse' | 'wolse',
): RealEstateTrend | null {
  const key = txnType === 'sale'
    ? `${propertyType}-sale`
    : `${propertyType}-rent-${txnType}`;
  return trends.find((t) => t.key === key) ?? null;
}

function changeColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (Math.abs(pct) < 0.05) return 'text-slate-400';
  if (pct > 0) return 'text-red-500';
  if (pct < 0) return 'text-primary-500';
  return 'text-slate-400';
}
</script>
