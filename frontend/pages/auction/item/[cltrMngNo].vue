<!-- frontend/pages/auction/item/[cltrMngNo].vue  — land [dong].vue와 동일하게 auto-import 사용(#imports 금지) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { SITE_URL } from '~/utils/seoConstants'
import { computeAuctionItemHead } from '~/utils/auctionHead'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
import AuctionBidHistory from '~/components/auction/AuctionBidHistory.vue'
import AuctionMap from '~/components/auction/AuctionMap.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'
// useRoute/useAsyncData/createError/useHead 는 Nuxt auto-import (land [dong].vue와 동일)

const route = useRoute()
const cltrMngNo = String(route.params.cltrMngNo)
const auction = useAuction()
const { data } = await useAsyncData(`auction-item-${cltrMngNo}`, () => auction.getItemDetail(cltrMngNo), { default: () => null })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })

const item = computed(() => data.value!.item)
const nearby = computed(() => data.value!.nearby)
const selfUrl = `${SITE_URL}/auction/item/${cltrMngNo}`
useHead(() => computeAuctionItemHead(item.value, selfUrl))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <div class="flex items-center gap-2 mb-2">
      <AuctionStatusBadge :status="item.status" />
      <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
    </div>
    <h1 class="text-display-3 font-bold text-slate-900">{{ item.address }}</h1>
    <p class="text-caption text-slate-500 mt-1">{{ item.usage }} · {{ item.orgNm }}</p>

    <div class="mt-4 grid gap-4">
      <AuctionBidHistory :item="item" />
      <AuctionMap v-if="item.lat != null && item.lng != null" :lat="item.lat" :lng="item.lng" :address="item.address" />

      <div v-if="nearby.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
        <h3 class="text-sm font-semibold text-slate-900 mb-3">같은 지역 공매 물건</h3>
        <div class="grid gap-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
      </div>

      <p class="text-caption text-slate-400">출처: 한국자산관리공사 온비드 (공공데이터포털)</p>
    </div>
  </div>
</template>
