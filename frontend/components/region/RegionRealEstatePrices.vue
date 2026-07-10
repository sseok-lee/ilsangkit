<template>
  <section id="real-estate" class="mb-6">
    <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-primary text-[22px]">apartment</span>
      부동산 시세 현황
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <NuxtLink
        v-for="item in cards"
        :key="item.type"
        :to="`/real-estate/${item.type}-sale`"
        class="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        <div class="flex items-center gap-2 mb-4">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <img :src="`/icons/category/${item.type}.webp?v2`" :alt="item.label" class="w-7 h-7" width="28" height="28" />
          </div>
          <h3 class="font-bold text-slate-900">{{ item.label }}</h3>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-100">
          <span class="text-sm text-slate-500">매매 평균</span>
          <span class="text-sm font-semibold text-slate-800">{{ item.saleAvg }}</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-100">
          <span class="text-sm text-slate-500">매매 거래</span>
          <span class="text-sm text-slate-600">{{ item.saleCount }}건</span>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-100">
          <span class="text-sm text-slate-500">전월세 평균 보증금</span>
          <span class="text-sm font-semibold text-slate-800">{{ item.rentAvg }}</span>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-slate-500">전월세 거래</span>
          <span class="text-sm text-slate-600">{{ item.rentCount }}건</span>
        </div>
      </NuxtLink>
    </div>
    <SourceStamp
      class="mt-3"
      variant="plain"
      provider="국토교통부"
      basis="전체 기간 누적"
      :synced-at="syncedAt ?? null"
      :stale-days="2"
    />
  </section>
</template>

<script setup lang="ts">
import SourceStamp from '~/components/common/SourceStamp.vue'

interface RealEstateCard {
  type: string
  label: string
  saleAvg: string
  saleCount: string | number
  rentAvg: string
  rentCount: string | number
}

defineProps<{
  cards: RealEstateCard[]
  syncedAt?: string | null
}>()
</script>
