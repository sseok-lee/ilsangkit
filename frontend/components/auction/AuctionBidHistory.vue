<!-- frontend/components/auction/AuctionBidHistory.vue -->
<script setup lang="ts">
import type { AuctionItem } from '~/types/auction'
import { formatWonKorean, formatBidRate, statusLabel } from '~/types/auction'
import SectionBlock from '~/components/common/SectionBlock.vue'
defineProps<{ item: AuctionItem }>()
</script>
<template>
  <SectionBlock heading="입찰 정보">
    <dl class="grid grid-cols-2 gap-y-2 text-sm">
      <dt class="text-slate-500">감정가</dt><dd class="text-right font-medium">{{ formatWonKorean(item.apslAssAmt) }}</dd>
      <dt class="text-slate-500">최저입찰가</dt><dd class="text-right font-medium">{{ formatWonKorean(item.minBidPrc) }}</dd>
      <template v-if="item.isClosed && item.winBidPrc != null">
        <dt class="text-slate-500">낙찰가</dt><dd class="text-right font-bold text-emerald-700">{{ formatWonKorean(item.winBidPrc) }}</dd>
        <dt class="text-slate-500">낙찰가율</dt><dd class="text-right font-bold text-emerald-700">{{ formatBidRate(item.bidRate) }}</dd>
      </template>
      <dt class="text-slate-500">유찰 횟수</dt><dd class="text-right">{{ item.failCnt }}회 ({{ item.bidRound ?? '-' }}차)</dd>
      <dt class="text-slate-500">처분방식</dt><dd class="text-right">{{ item.dpslMtdNm ?? '-' }}</dd>
      <dt class="text-slate-500">상태</dt><dd class="text-right">{{ statusLabel(item.status) }}</dd>
    </dl>
  </SectionBlock>
</template>
