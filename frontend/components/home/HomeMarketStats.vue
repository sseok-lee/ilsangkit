<template>
  <section v-if="trends.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
          오늘의 부동산 시장
        </h2>
        <p class="text-sm text-slate-500 mt-1">최근 7일 거래일 기준 평균과 전주 대비 변동입니다.</p>
      </div>
      <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">전체 보기 →</HardLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <div
        v-for="t in trends"
        :key="t.key"
        :data-key="t.key"
        class="flex flex-col gap-3 p-5 border border-line rounded-2xl shadow-card bg-white"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">{{ iconFor(t.key) }}</span>
            <span class="font-bold text-slate-900">{{ t.label }}</span>
          </div>
          <span class="text-[11px] text-slate-400">최근 7일</span>
        </div>
        <div class="flex items-baseline gap-2">
          <strong class="text-2xl font-black tracking-tight text-slate-900">{{ formatPrice(t.avgPrice) }}</strong>
          <span class="text-xs text-slate-400">평균</span>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <div class="text-[11px] text-slate-400">거래량</div>
            <div class="text-sm font-bold text-slate-900">{{ t.txnCount.toLocaleString('ko-KR') }}건</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-slate-400">전주 대비</div>
            <div
              class="text-sm font-bold flex items-center justify-end gap-0.5"
              :class="changeColor(t.changePct)"
            >
              <span v-if="t.changePct !== null && t.changePct > 0" class="material-symbols-outlined text-[14px]">arrow_drop_up</span>
              <span v-else-if="t.changePct !== null && t.changePct < 0" class="material-symbols-outlined text-[14px]">arrow_drop_down</span>
              {{ formatChange(t.changePct) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue';
import { formatPrice, formatChange } from '~/utils/priceFormat';
import type { RealEstateTrend } from '~/composables/useHomeDashboard';

defineProps<{ trends: RealEstateTrend[] }>();

function iconFor(key: RealEstateTrend['key']): string {
  if (key === 'apt-sale') return 'apartment';
  if (key === 'apt-rent-jeonse') return 'domain';
  return 'corporate_fare';
}

function changeColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct > 0) return 'text-red-500';
  if (pct < 0) return 'text-blue-500';
  return 'text-slate-400';
}
</script>
