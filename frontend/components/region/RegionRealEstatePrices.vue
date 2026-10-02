<template>
  <SectionBlock id="real-estate" variant="flat" heading="부동산 시세 현황">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <NuxtLink
        v-for="item in cards"
        :key="item.type"
        :to="`/real-estate/${item.type}-sale`"
        class="group block rounded-[10px] border border-line bg-white px-5 py-[18px] transition-colors hover:border-primary"
      >
        <div class="flex items-center gap-2.5 mb-2.5">
          <img :src="`/icons/category/${item.type}.webp?v2`" :alt="item.label" class="w-7 h-7" width="28" height="28" />
          <h3 class="ui-h3 text-strong group-hover:text-primary">{{ item.label }}</h3>
        </div>
        <dl class="text-sm">
          <div class="flex items-center justify-between py-2.5 border-b border-line">
            <dt class="text-muted">매매 평균</dt>
            <dd class="font-semibold text-ink tabular-nums">{{ item.saleAvg }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5 border-b border-line">
            <dt class="text-muted">매매 거래</dt>
            <dd class="text-ink tabular-nums">{{ item.saleCount }}건</dd>
          </div>
          <div class="flex items-center justify-between py-2.5 border-b border-line">
            <dt class="text-muted">전월세 평균 보증금</dt>
            <dd class="font-semibold text-ink tabular-nums">{{ item.rentAvg }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-muted">전월세 거래</dt>
            <dd class="text-ink tabular-nums">{{ item.rentCount }}건</dd>
          </div>
        </dl>
      </NuxtLink>
    </div>
    <SourceStamp
      class="mt-3"
      variant="plain"
      provider="국토교통부"
      basis="전체 기간 누적"
      :synced-at="syncedAt ?? null"
      :stale-days="RE_STALE_DAYS"
    />
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import SourceStamp from '~/components/common/SourceStamp.vue'
import { RE_STALE_DAYS } from '~/utils/syncFreshness'

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
