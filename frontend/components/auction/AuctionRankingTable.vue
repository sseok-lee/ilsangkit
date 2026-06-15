<!-- frontend/components/auction/AuctionRankingTable.vue -->
<script setup lang="ts">
import type { AuctionAreaSummary } from '~/types/auction'
import { formatBidRate, USAGE_GROUP_LABEL } from '~/types/auction'
defineProps<{ rows: AuctionAreaSummary[] }>()
</script>
<template>
  <table class="w-full text-sm">
    <thead><tr class="text-caption text-faint bg-background-light border-b border-line">
      <th class="text-left py-2">지역</th><th class="text-left">용도</th><th class="text-right">낙찰가율</th><th class="text-right">낙찰</th>
    </tr></thead>
    <tbody>
      <tr v-for="(r, i) in rows" :key="i" class="border-b border-line/60">
        <td class="py-2 text-strong">{{ r.district }}</td>
        <td class="text-strong">{{ USAGE_GROUP_LABEL[r.usageGroup] }}</td>
        <td class="text-right font-semibold font-display tabular-nums text-strong">{{ formatBidRate(r.avgBidRate) }}</td>
        <td class="text-right text-muted font-display tabular-nums">{{ r.soldCount }}건</td>
      </tr>
    </tbody>
  </table>
</template>
