<!-- frontend/components/auction/AuctionCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AuctionItem } from '~/types/auction'
import { formatWonKorean, formatDiscount, formatAuctionDate, USAGE_GROUP_LABEL } from '~/types/auction'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
// 목록→상세 이동을 전체 새로고침(MPA)으로 — SPA soft-nav 시 AdSense가 unfill-optimized로
// 광고를 안 채우는 문제 회피. 기존 카드(FacilityCard 등)와 동일하게 HardLink 사용.
import HardLink from '~/components/common/HardLink.vue'
const props = defineProps<{ item: AuctionItem }>()
const to = computed(() => `/auction/item/${props.item.cltrMngNo}`)
const apsl = computed(() => props.item.apslAssAmt)
const minBid = computed(() => props.item.minBidPrc)
const apslDisplay = computed(() => (apsl.value && apsl.value > 0 ? formatWonKorean(apsl.value) : '-'))
const minDisplay = computed(() => (minBid.value && minBid.value > 0 ? formatWonKorean(minBid.value) : '-'))
// 최저가는 감정가와 다를 때(또는 감정가 없을 때)만 별도 노출 — 1차(최저=감정)는 감정가만
const showMinBid = computed(() =>
  !!minBid.value && minBid.value > 0 && (!apsl.value || apsl.value <= 0 || minBid.value !== apsl.value),
)
// 할인율은 실제 할인(최저 < 감정)일 때만 — 0%/+값 노이즈 제거
const hasDiscount = computed(() => !!apsl.value && apsl.value > 0 && !!minBid.value && minBid.value > 0 && minBid.value < apsl.value)
const discount = computed(() => formatDiscount(props.item.apslAssAmt, props.item.minBidPrc))
</script>
<template>
  <HardLink :to="to" class="block bg-white rounded-xl border border-line p-4 shadow-card hover:border-primary/30 transition-[box-shadow,border-color]">
    <div class="flex items-center gap-2 mb-2">
      <AuctionStatusBadge :status="item.status" />
      <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
      <span v-if="item.failCnt > 0" class="text-caption text-rose-600">유찰 {{ item.failCnt }}회</span>
      <span v-if="item.bidRound" class="text-caption text-slate-400">{{ item.bidRound }}차</span>
    </div>
    <p class="text-sm font-semibold text-slate-900 truncate">{{ item.address }}</p>
    <p class="text-caption text-slate-500 mt-0.5">{{ item.usage ?? USAGE_GROUP_LABEL[item.usageGroup] }} · 📍{{ item.district }}</p>
    <div class="mt-3 flex items-end justify-between gap-2">
      <div class="min-w-0">
        <p class="text-caption text-slate-400">감정가</p>
        <p class="text-sm font-bold text-slate-900">{{ apslDisplay }}</p>
        <p v-if="showMinBid" class="text-caption text-slate-500 mt-0.5">
          최저가 {{ minDisplay }}<span v-if="hasDiscount" class="ml-1 font-medium text-emerald-600">{{ discount }}</span>
        </p>
      </div>
      <p class="text-caption text-slate-500 whitespace-nowrap">{{ formatAuctionDate(item.bidCloseDtm) }} 마감</p>
    </div>
  </HardLink>
</template>
