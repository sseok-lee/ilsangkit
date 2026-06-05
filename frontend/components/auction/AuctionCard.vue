<!-- frontend/components/auction/AuctionCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AuctionItem } from '~/types/auction'
import { formatWon, formatDiscount, formatAuctionDate, USAGE_GROUP_LABEL } from '~/types/auction'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
const props = defineProps<{ item: AuctionItem }>()
const to = computed(() => `/auction/item/${props.item.cltrMngNo}`)
const discount = computed(() => formatDiscount(props.item.apslAssAmt, props.item.minBidPrc))
</script>
<template>
  <NuxtLink :to="to" class="block bg-white rounded-xl border border-line p-4 shadow-card hover:border-primary/30 transition-[box-shadow,border-color]">
    <div class="flex items-center gap-2 mb-2">
      <AuctionStatusBadge :status="item.status" />
      <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
      <span v-if="item.failCnt > 0" class="text-caption text-rose-600">유찰 {{ item.failCnt }}회</span>
      <span v-if="item.bidRound" class="text-caption text-slate-400">{{ item.bidRound }}차</span>
    </div>
    <p class="text-sm font-semibold text-slate-900 truncate">{{ item.address }}</p>
    <p class="text-caption text-slate-500 mt-0.5">{{ item.usage ?? USAGE_GROUP_LABEL[item.usageGroup] }} · 📍{{ item.district }}</p>
    <div class="mt-3 flex items-end justify-between">
      <div>
        <p class="text-caption text-slate-400">감정가</p>
        <p class="text-sm font-bold text-slate-900">{{ formatWon(item.apslAssAmt) }}<span v-if="discount !== '-'" class="ml-1 text-xs text-emerald-600">{{ discount }}</span></p>
      </div>
      <p class="text-caption text-slate-500">{{ formatAuctionDate(item.bidCloseDtm) }} 마감</p>
    </div>
  </NuxtLink>
</template>
